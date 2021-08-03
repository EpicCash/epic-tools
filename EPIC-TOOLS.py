import sys
from tkinter.filedialog import askopenfilename
from copy import deepcopy
from fernet import Fernet
from tinydb import Query
from pathlib import Path
from tkinter import Tk
import multiprocessing
import subprocess
import logging
import cpuinfo
import GPUtil
import atexit
import eel
import os

from src.db import db
from src.tools import edit_server_toml
from src.tools import save_pass, check_process, ProcessPool


logging.basicConfig(filename='app.log', encoding='utf-8', level=logging.INFO,
                    format='%(asctime)s %(levelname)s %(message)s', datefmt='%m/%d/%Y %I:%M:%S %p')
eel.init('web')
pool = ProcessPool()


@eel.expose
def pool_updater():
    names = {
        'epic.exe': 'stopServer',
        'epic-wallet.exe': 'stopListener',
        'epic-miner-cpu.exe': 'stopCPU',
        'epic-miner-gpu.exe': 'stopGPU'
        }
    snapshot = pool.read_db()
    response = []

    for k, v in snapshot.items():
        try:
            pool.add(k, check_process(k).pid, is_running(k))
        except:
            pool.add(k, 0, is_running(k))

    data = pool.read_db()
    for k, v in data.items():
        if not v['running']:
            response.append(names[k])
            # print(response)
    print(pool.read_db())
    return response


@eel.expose
def close_process(process):
    pool.kill(proc=process)
    print(f"{process} terminated.")
    return True


def exit_handler():
    """Code to be executed before ordinary script terminations"""
    # Kill all working processes before quit
    list = deepcopy(pool.list)
    for p in list:
        pool.kill(p)
        print(f'KILLING {p}')
        logging.info(f"KILLING {p}")


atexit.register(exit_handler)


@eel.expose
def get_cpu():
    """ Get CPU information to show user """
    cpu = cpuinfo.get_cpu_info()
    cpu_string = f"{cpu['brand_raw']}"
    data = {
        'string': cpu_string,
        'link': f"https://www.google.com/search?q={cpu_string}+randomx"
        }
    return data


@eel.expose
def get_gpu():
    """ Get GPU information to show user """
    try:
        gpu = [gpu for gpu in GPUtil.getGPUs()][0]
        gpu_string = f"{gpu.name}"
    except:
        gpu_string = ''
        logging.info(gpu_string)
    data = {
        'string': gpu_string,
        'link': f"https://www.google.com/search?q={gpu_string}+progpow"
        }
    return data


@eel.expose
def is_wallet():
    """ Checking in database if wallet was already created """
    Created = Query().type == 'wallet_created'
    print(db.get(Created)['value'])
    return db.get(Created)['value']


@eel.expose
def rollback_check():
    """ Checking for rollback-flag file and show status"""
    file = "2-15-rollback-flag"
    cwd = os.path.join(os.getcwd(), "epic-server")
    file_path = os.path.join(cwd, file)
    my_file = Path(file_path)

    if my_file.exists():
        return False
    else:
        msg = f"Downloading blockchain..."
        logging.warning(msg)
        return True


@eel.expose
def is_running(process):
    if check_process(process):
        return True
    return False


@eel.expose
def start_gpu_miner():
    cwd = os.path.join(os.getcwd(), "gpu-miner")
    file = 'epic-miner-gpu.exe'
    process = pool.get_or_run(file, cwd)


@eel.expose
def start_cpu_miner():
    cwd = os.path.join(os.getcwd(), "cpu-miner")
    file = 'epic-miner-cpu.exe'
    process = pool.get_or_run(file, cwd)


@eel.expose
def start_listener():
    cwd = os.path.join(os.getcwd(), "epic-wallet")
    os.chdir(cwd)
    file = 'epic-wallet.exe'
    Created = Query().type == 'wallet_created'
    Password = Query().type == 'wallet_password'
    key = db.get(Query().type == 'key')['value']
    key = Fernet(key.encode('utf-8'))
    password = db.get(Password)['value'].encode('utf-8')
    password = key.decrypt(password).decode('utf-8')
    running = check_process(file)

    if running:
        process = running
    else:
        process = subprocess.Popen([file, "-p", f"{password}", "listen"],
                                   stderr=subprocess.STDOUT, stdout=subprocess.PIPE)
        stdout = str(process.stdout)
        logging.info(process.stdout)

        if "Wallet seed file doesn't exist" in stdout:
            db.update({'value': False}, Created)
            logging.warning(stdout)
            os.chdir('..')
            return False

    logging.info('Listener running')
    os.chdir('..')
    pool.add(file, process.pid)
    # print(pool.list)
    return True


def bar_progress(current, total, width=80):
    progress_message = "Downloading: %d%% [%d / %d] bytes" % (current / total * 100, current, total)
    # Don't use print() as it will print in new line every time.
    sys.stdout.write("\r" + progress_message)
    sys.stdout.flush()


@eel.expose
def start_server():
    cwd = os.path.join(os.getcwd(), "epic-server")
    file = 'epic.exe'
    os.chdir(cwd)

    # If server starts for the first time create config file
    if not os.path.isfile('epic-server.toml'):

        # Run server for the first time with extra args
        process = subprocess.run([file, "server", "config"],
                                 stderr=subprocess.STDOUT,
                                 stdout=subprocess.PIPE)
        logging.info(process.stdout)

        # Make changes in config file to prevent synchronization bug
        edit_server_toml('epic-server.toml')
        logging.info(f"epic-server.toml edited successfully")

        # Check for rollback-file and download canonical data blockchain file
        if rollback_check():
            print('tutaj')
            import wget
            wget.download(url='https://epiccash.s3-sa-east-1.amazonaws.com/chain_data_synced_861141.zip',
                          bar=bar_progress)

    # Start epic.exe process
    process = pool.get_or_run(file, cwd)
    try:
        logging.info(process.communicate())
    except:
        pass
    os.chdir('..')
    return True


@eel.expose
def create_wallet(password):
    # Save encrypted password to database
    save_pass(password)
    Created = Query().type == 'wallet_created'
    cwd = os.path.join(os.getcwd(), "epic-wallet")
    file = os.path.join(cwd, 'epic-wallet.exe')

    # Run epic-wallet init command and create config file
    process = subprocess.run([file, "-p", f"{password}", "init", "-h"], cwd=cwd,
                             stderr=subprocess.STDOUT, stdout=subprocess.PIPE)
    stdout = str(process.stdout)

    if 'successfully' in stdout:
        # Show to user 12/24 word seed phrase
        lines = str(process.stdout).split('\\n')
        db.update({'value': True}, Created)
        return f"{lines[5]}"
    elif 'already exists' in stdout:
        db.update({'value': True}, Created)
        logging.info(stdout)
    else:
        logging.warning(stdout)
        return False


@eel.expose
def upload_file():
    root = Tk()
    root.withdraw()
    root.wm_attributes('-topmost', 1)
    file = askopenfilename(filetypes=[('TOML Files', '*toml')])
    if 'epic-server' in file:
        return file
    else:
        return False


if __name__ == "__main__":
    multiprocessing.freeze_support()
    eel.start('templates/home.html',
              jinja_templates='templates',
              size=(800, 700),
              port=5001)
