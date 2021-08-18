# Standard library
from tkinter.filedialog import askdirectory
from copy import deepcopy
from pathlib import Path
from tkinter import Tk
from time import sleep
import multiprocessing
import subprocess
import datetime
import requests
import logging
import json
import os

# 3rd party modules
import cpuinfo
import GPUtil
import shutil
import atexit
import eel

# App imports, 'try' block because of pyinstaller problems with relative paths
try:
    from src.tools import edit_server_toml, get_directory_size, open_port
    from src.tools import save_pass, check_process, ProcessPool
    from src.wallet import Wallet
except Exception:
    from .src.tools import edit_server_toml, get_directory_size, open_port
    from .src.tools import save_pass, check_process, ProcessPool
    from .src.wallet import Wallet

# Hide unwanted CMD windows
si = subprocess.STARTUPINFO()
si.dwFlags |= subprocess.STARTF_USESHOWWINDOW

# Logging configuration
logging.basicConfig(filename='app.log', format='%(asctime)s %(levelname)s %(message)s',
                    datefmt='%m/%d/%Y %I:%M:%S %p', encoding='utf-8', level=logging.INFO)

# EEL GUI package
eel.init('web')

# Initialize process manager and wallet instance
pool = ProcessPool()
wallet = Wallet(
    file_name='epic-wallet.exe', pool=pool,
    cwd=os.path.join(os.getcwd(), "epic-wallet")
    )


# ------ WALLET FUNCTIONS - #
@eel.expose
def is_wallet():
    """ Checking in database if wallet was already created """
    return wallet.created()


@eel.expose
def create_wallet(password):
    return wallet.create(password)


@eel.expose
def start_listener():
    return wallet.run_listener()


@eel.expose
def wallet_balance():
    return wallet.balance()


@eel.expose
def withdraw_from_wallet(address):
    return wallet.send(address)


@eel.expose
def wallet_data():
    data = {
        'ext_ip': wallet.ext_ip(),
        'port': wallet.cfg['listener_port'],
        'open_port': open_port(wallet.cfg['listener_port'])
        }
    return data


@eel.expose
def greetings():
    name = os.getlogin()
    msg = f"Hey {name}, have a nice day!"
    return msg


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
    #             # print(response)

    if ('epic-miner-gpu.exe' and 'epic-miner-cpu.exe') not in data.keys():
        # print('no miner is running')
        eel.stopMining()

    # print(data)
    return response


@eel.expose
def close_process(process):
    pool.kill(proc=process)
    # print(f"{process} terminated.")
    return True


def exit_handler():
    """Code to be executed before main script terminations"""
    # Kill all working processes before quit
    list = deepcopy(pool.list)
    for p in list:
        pool.kill(p)
        # print(f'KILLING {p}')
        # logging.info(f"KILLING {p}")


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
    # logging.info(cpu_string)
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
    # logging.info(gpu_string)
    return data


@eel.expose
def get_height():
    """Get blockchain height from explorer.epic.tech API"""
    url = "https://explorer.epic.tech/api?q=getblockcount"
    return json.loads(requests.get(url).content)


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
        # print('no rollback file')
        # logging.warning('no rollback file')
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
    # print(f'new backup name: {name}')

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
                # print(old_backup)
    except Exception as e:
        pass
        # print(e)

    try:
        if os.path.isdir(os.path.join(cwd, dir)):
            shutil.copytree(os.path.join(cwd, dir),
                            os.path.join(cwd, name),
                            dirs_exist_ok=True)
            # logging.info('chain_data backup done successfully')

            if old_backup:
                shutil.rmtree(os.path.join(cwd, old_backup))
                # print(f'Removed old backup {old_backup}')

    except Exception as e:
        if old_backup:
            os.rename(os.path.join(cwd, old_backup),
                      os.path.join(cwd, old_backup_name))
        # print(e)
        # logging.warning(e)

    return True

@eel.expose
def upload_chain_data(input=None):
    root = Tk()
    cwd = os.path.join(os.getcwd(), "epic-server")
    destination = os.path.join(cwd, 'chain_data')
    to_copy = ['header', 'lmdb', 'txhashset']

    if not input:
        # Tkinter pick directory dialog
        root.wm_attributes('-topmost', 1)
        root.overrideredirect(1)
        root.withdraw()
        chain_data = askdirectory()
    else:
        chain_data = input

    try:
        dirs = [[f.name, f.path] for f in os.scandir(chain_data)
                if f.is_dir() and f.name in to_copy]

        if len(dirs) < 3:
            # print(dirs)
            return False

        # close epic server before changes in chain_data
        file = 'epic.exe'
        if check_process(file):
            pool.kill(check_process(file))
            sleep(3)

        for dir in dirs:
            shutil.copytree(dir[1], os.path.join(destination, dir[0]),
                            dirs_exist_ok=True)
            msg = f'{dir[0]} moved to destination'
            print(msg)
            logging.info(msg)

        return True
    except Exception as e:
        print(e)


@eel.expose
def restore_chain_data():
    cwd = os.path.join(os.getcwd(), "epic-server")

    # close epic server before changes in chain_data
    file = 'epic.exe'
    if check_process(file):
        pool.kill(check_process(file))
        sleep(3)

    # backup current chain_data to old_chain_data, remove if old one existed
    for dir in os.listdir(cwd):
        if os.path.isdir(os.path.join(cwd, dir)):
            if dir == 'chain_data':
                try:
                    os.rename(os.path.join(cwd, dir),
                              os.path.join(cwd, f'old_{dir}'))
                except Exception as e:
                    # print(e)
                    shutil.rmtree(os.path.join(cwd, f'old_{dir}'))
                    os.rename(os.path.join(cwd, dir),
                              os.path.join(cwd, f'old_{dir}'))
                # print(f'{dir} copied to old_{dir}')

    # restore chain_data from existing backup directory or false
    for dir in os.scandir(cwd):
        if dir.name.endswith('_backup'):
            return upload_chain_data(input=dir.path)

    return False


@eel.expose
def blockchain_size(str=False):
    cwd = os.path.join(os.getcwd(), "epic-server")
    size, suffix = get_directory_size(os.path.join(cwd, 'chain_data'))
    # print(f"{size}{suffix}")
    if str:
        return f"{size}{suffix}"
    return size, suffix


@eel.expose
def chain_data_exists():
    cwd = os.path.join(os.getcwd(), "epic-server")
    for dir in os.scandir(cwd):
        if dir.name == 'chain_data':
            return True
    return False


@eel.expose
def chain_data_outdated():
    if blockchain_size()[1] not in ['B', 'KB', 'MB']:
        return False
    return True


@eel.expose
def first_backup():
    cwd = os.path.join(os.getcwd(), "epic-server")
    for dir in os.listdir(cwd):
        if dir.endswith('_backup'):
            return True
    print('false')
    return False


@eel.expose
def remove_peers():
    file = 'epic.exe'
    if check_process(file):
        pool.kill(check_process(file))
        sleep(3)
    try:
        cwd = os.path.join(os.getcwd(), "epic-server/chain_data")
        shutil.rmtree(os.path.join(cwd, 'peer'))
        # print('peers deleted')
        return True
    except Exception as e:
        # print(e)
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
def node_data():
    if is_running('epic.exe'):
        try:
            url = f"http://127.0.0.1:3413/v1/status"
            # print(json.loads(requests.get(url).content))
            return json.loads(requests.get(url).content)
        except Exception as e:
            # print(e)
            return False
    else:
        return False


@eel.expose
def start_server():
    cwd = os.path.join(os.getcwd(), "epic-server")
    file = 'epic.exe'
    # print(fr'{cwd}')
    os.chdir(cwd)

    # If server starts for the first time create config file
    if not os.path.isfile('epic-server.toml'):
        # Run server for the first time with extra args
        process = subprocess.run([file, "server", "config"],
                                 stderr=subprocess.STDOUT,
                                 stdout=subprocess.PIPE,
                                 startupinfo=si)
        # logging.info(process.stdout)

        # Make changes in config file to prevent synchronization bug
        edit_server_toml('epic-server.toml')
        # logging.info(f"epic-server.toml edited successfully")

    # Start epic.exe process
    process = pool.get_or_run(file, cwd)
    os.chdir('..')
    return True


if __name__ == "__main__":
    root = Tk()
    screen_height = root.winfo_screenheight()
    root.overrideredirect(1)
    root.destroy()

    if screen_height < 950:
        height = int(screen_height) - 50
    else:
        height = 900

    multiprocessing.freeze_support()
    try:
        eel.start('templates/home.html',
                  jinja_templates='templates',
                  size=(1000, height), port=3333)
    except Exception as e:
        pass
