from setuptools._vendor import more_itertools
from fernet import Fernet
from copy import deepcopy
from tinydb import Query
from pathlib import Path
from time import sleep
import multiprocessing
import subprocess
import datetime
import requests
import logging
import cpuinfo
import GPUtil
import shutil
import atexit
import json
import eel
import os
import re

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
    """Get CPU information to show user with link to benchmarks"""
    try:
        cpu = cpuinfo.get_cpu_info()
        cpu_string = f"{cpu['brand_raw']}"
    except:
        cpu_string = 'N/A'
    data = {
        'string': cpu_string,
        'link': f"https://www.google.com/search?q={cpu_string}+randomx"
        }
    logging.info(cpu_string)
    return data


@eel.expose
def get_gpu():
    """Get GPU information to show user with link to benchmarks"""
    try:
        gpu = [gpu for gpu in GPUtil.getGPUs()][0]
        gpu_string = f"{gpu.name}"
    except:
        gpu_string = 'N/A'
    data = {
        'string': gpu_string,
        'link': f"https://www.google.com/search?q={gpu_string}+progpow"
        }
    logging.info(gpu_string)
    return data


@eel.expose
def get_height():
    """Get blockchain height from explorer.epic.tech API"""
    url = "https://explorer.epic.tech/api?q=getblockcount"
    return json.loads(requests.get(url).content)


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
        print('no rollback file')
        logging.warning('no rollback file')
        return True


@eel.expose
def is_running(process):
    if check_process(process):
        return True
    return False


@eel.expose
def backup_db():
    dir = 'chain_data'
    cwd = os.path.join(os.getcwd(), "epic-server")
    file = 'epic.exe'
    now = datetime.datetime.now()
    name = f"{now.day}_{now.month}_{dir}_backup"
    old_backup = False
    old_backup_name = False
    print(f'new backup name: {name}')

    if check_process(file):
        pool.kill(check_process(file))
        sleep(3)

    try:
        for d in os.listdir(cwd):
            if d.endswith('_backup'):
                old_backup_name = d
                os.rename(os.path.join(cwd, d),
                          os.path.join(cwd, f'{d}_to_remove'))
                old_backup = f'{d}_to_remove'
                print(old_backup)
    except Exception as e:
        print(e)

    try:
        if os.path.isdir(os.path.join(cwd, dir)):
            shutil.copytree(os.path.join(cwd, dir),
                            os.path.join(cwd, name),
                            dirs_exist_ok=True)
            logging.info('chain_data backup done successfully')

            if old_backup:
                shutil.rmtree(os.path.join(cwd, old_backup))
                print(f'Removed old backup {old_backup}')

    except Exception as e:
        if old_backup:
            os.rename(os.path.join(cwd, old_backup),
                      os.path.join(cwd, old_backup_name))
        print(e)
        logging.warning(e)

    return True


@eel.expose
def restore_chain_data():
    cwd = os.path.join(os.getcwd(), "epic-server")

    for dir in os.listdir(cwd):
        if os.path.isdir(os.path.join(cwd, dir)):
            if dir == 'chain_data':
                try:
                    os.rename(os.path.join(cwd, dir),
                              os.path.join(cwd, f'old_{dir}'))
                except Exception as e:
                    print(e)
                    shutil.rmtree(os.path.join(cwd, f'old_{dir}'))
                    os.rename(os.path.join(cwd, dir),
                              os.path.join(cwd, f'old_{dir}'))
                print(dir)

    for dir in os.listdir(cwd):
        if dir.endswith('_backup'):
            shutil.copytree(os.path.join(cwd, dir),
                            os.path.join(cwd, 'chain_data'),
                            dirs_exist_ok=True)
    return True


@eel.expose
def first_backup():
    cwd = os.path.join(os.getcwd(), "epic-server")
    first_backup = False

    for dir in os.listdir(cwd):
        if dir.endswith('_backup'):
            first_backup = True

    if not first_backup:
        print('doing 1st backup')

    return first_backup


@eel.expose
def remove_peers():
    file = 'epic.exe'
    if check_process(file):
        pool.kill(check_process(file))
        sleep(3)
    try:
        cwd = os.path.join(os.getcwd(), "epic-server/chain_data")
        shutil.rmtree(os.path.join(cwd, 'peer'))
        print('peers deleted')
        return True
    except Exception as e:
        print(e)
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
def wallet_balance():
    b = []
    cwd = os.path.join(os.getcwd(), "epic-wallet")
    Password = Query().type == 'wallet_password'
    key = db.get(Query().type == 'key')['value']
    key = Fernet(key.encode('utf-8'))
    password = db.get(Password)['value'].encode('utf-8')
    password = key.decrypt(password).decode('utf-8')
    os.chdir(cwd)

    try:
        info = os.popen(f'epic-wallet -p {password} info').read()
        print(info)
        for line in info.split('\n'):
            patter = r"\d+.\d+"
            match = re.findall(patter, line)
            if match:
                print(match)
                b.append(match)
        b = [n for n in list(more_itertools.collapse(b))]
        balances = {
            'total': float(b[-5]),
            'wait_conf': float(b[-4]),
            'wait_final': float(b[-3]),
            'locked': float(b[-2]),
            'spendable': float(b[-1]),
            'height': b[0]
            }
        os.chdir('..')
        print(balances)
        return balances

    except Exception as e:
        print(e)
        os.chdir('..')
        return False


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


# @eel.expose
# def upload_file():
#     root = Tk()
#     root.withdraw()
#     root.wm_attributes('-topmost', 1)
#     file = askopenfilename(filetypes=[('TOML Files', '*toml')])
#     if 'epic-server' in file:
#         return file
#     else:
#         return False


if __name__ == "__main__":
    multiprocessing.freeze_support()
    eel.start('templates/home.html',
              jinja_templates='templates',
              size=(900, 900),
              port=5001)
