# Standard library
import os
import platform
import subprocess
import sys
from ast import literal_eval
from concurrent import futures
from multiprocessing.spawn import freeze_support
from threading import Thread
from tkinter import Tk
from multiprocessing import Process
import pathlib
import atexit

# 3rd party modules
import eel

# App imports
# 'try' block because of pyinstaller problems with relative paths
import gevent

try:
    from src.managers import ProcessManager
    from src.tools import OtherData, run_ngrok_, check_ngrok_tunnel, change_toml_setting
    from src.wallet import Wallet
    from src.server import Server
    from src.miners import Miner
    from src.logs import init_logs
    from src.db import db

except Exception:
    from .src.managers import ProcessManager
    from .src.tools import OtherData, run_ngrok_, check_ngrok_tunnel, change_toml_setting
    from .src.wallet import Wallet
    from .src.server import Server
    from .src.miners import Miner
    from .src.logs import init_logs
    from .src.db import db

PROJECT_DIR = pathlib.Path(__file__).resolve().parents[1]
APP_DIR = pathlib.Path(__file__).resolve().parent
LOG_DIR = os.path.join(PROJECT_DIR, 'logs')
LOG_FILE = os.path.join(LOG_DIR, 'app.log')


# EEL GUI package
eel.init('web')

# Initialize logger, process manager and wallet instance
p_manager = ProcessManager()
logger = init_logs(__name__)
wallet = Wallet(file_name='epic-wallet.exe', p_manager=p_manager)
server = Server(p_manager=p_manager)
root = Tk()


# /------------- WALLET FUNCTIONS -------------/ #

@eel.expose
def is_wallet():
    created = wallet.created()
    if created:
        eel.walletExists()
        print('wallet')
    else:
        print('not-wallet')
        eel.walletNotExists()


@eel.expose
def create_wallet(password):
    return wallet.create(password)


@eel.expose
def require_password():
    return wallet.require_password()


@eel.expose
def start_listener():
    return wallet.run_listener()


@eel.expose
def wallet_balance():
    p = eel.spawn(wallet.balance)
    p.join()
    return p.value


@eel.expose
def send(address, amount, method, password):
    return wallet.send(address, amount, method, password)


@eel.expose
def create_response():
    return wallet.create_response(root=root)


@eel.expose
def finalize_tx():
    return wallet.finalize_tx(root=root)


@eel.expose
def transactions():
    p = eel.spawn(wallet.transactions)
    p.join()
    return p.value


@eel.expose
def cancel_tx(id):
    return wallet.cancel_tx(id)


@eel.expose
def check():
    p = eel.spawn(wallet.check)
    p.join()
    return p.value


@eel.expose
def wallet_data():
    with futures.ThreadPoolExecutor() as executor:
        future = executor.submit(wallet.gui_data)
        value = future.result()
    return value


@eel.expose
def show_seed_phrase(password):
    with futures.ThreadPoolExecutor() as executor:
        future = executor.submit(wallet.show_seed_phrase, password=password)
        value = future.result()
    return value


@eel.expose
def verify_password(password):
    return wallet.verify_password(password)


@eel.expose
def run_terminal():
    return wallet.run_terminal()


@eel.expose
def backup_wallet_data():
    with futures.ThreadPoolExecutor() as executor:
        future = executor.submit(wallet.backup_data)
        value = future.result()
    return value


@eel.expose
def import_data():
    return wallet.import_data(root=root)


@eel.expose
def open_wallet_dir():
    return wallet.open_dir()


# /------------- SERVER FUNCTIONS -------------/ #

@eel.expose
def rollback_check():
    """ Checking for rollback-flag file and show status"""
    return server.rollback_status()


@eel.expose
def backup_db():
    return server.backup_chain_data()


@eel.expose
def upload_chain_data(source=None):
    return server.load_chain_data(root=root, source=source)


@eel.expose
def restore_chain_data():
    return server.fix_data_chain()


@eel.expose
def blockchain_size(_str=False):
    return server.chain_data_size(_str=_str)


@eel.expose
def chain_data_exists():
    return server.chain_data_exists()


@eel.expose
def chain_data_outdated():
    return server.chain_data_outdated()


@eel.expose
def first_backup():
    return server.backup_exists()


@eel.expose
def remove_peers():
    return server.remove_peers()


@eel.expose
def node_data():
    with futures.ThreadPoolExecutor() as executor:
        future = executor.submit(server.data)
        value = future.result()
    return value


@eel.expose
def start_server():
    return server.start()


@eel.expose
def open_server_dir():
    return server.open_dir()


# /------------- PROCESS FUNCTIONS -------------/ #
@eel.expose
def start_gpu_miner():
    return Miner(algo='gpu').run()


@eel.expose
def start_cpu_miner():
    return Miner(algo='cpu').run()


@eel.expose
def check_for_mining_soft():
    data = p_manager.get_running()
    return data


@eel.expose
def log(msg):
    logger.info(f"WEB LOG[{msg}]")


@eel.expose
def run_ngrok():
    if not check_ngrok_tunnel():
        run_ngrok_(wallet.cfg['port'])
    tunnel = check_ngrok_tunnel()
    print(tunnel)
    return tunnel


@eel.expose
def close_process(process):
    if isinstance(process, list):
        for p in process:
            p_manager.kill(process=p)
    elif isinstance(process, str):
        p_manager.kill(process=process)


@eel.expose
def other_data():
    return OtherData().run()


@eel.expose
def open_toml_file(file):
    if file == 'server':
        file_path = server.toml.file
    elif file == 'wallet':
        file_path = wallet.toml.file
    elif file == 'miner_cpu':
        file_path = Miner(algo='cpu').toml.file
    elif file == 'miner_gpu':
        file_path = Miner(algo='gpu').toml.file
    else:
        logger.error(f'TOML: {file} not found')
        return False

    if os.path.isfile(file_path):
        os.startfile(file_path)
        return True


@eel.expose
def open_log_file(file):
    if file == 'server':
        file_path = server.log.file
    elif file == 'wallet':
        file_path = wallet.log.file
    elif file == 'miner_cpu':
        file_path = Miner(algo='cpu').log.file
    elif file == 'miner_gpu':
        file_path = Miner(algo='gpu').log.file
    elif file == 'app':
        file_path = LOG_FILE
    else:
        logger.error(f'TOML: {file} not found')
        return False

    if os.path.isfile(file_path):
        os.startfile(file_path)
        return True


@eel.expose
def create_user(username):
    db.save('user', {'username': username})


@eel.expose
def greetings():
    return OtherData().greetings()


@eel.expose
def db_get(table, key):
    return db.get(table, key)


@eel.expose
def db_save(table, data, toml=False):
    print(table, data)
    if isinstance(data, str):
        data = literal_eval(data)

    if toml:
        file = db.get(table, 'toml_path')
        change_toml_setting(file_path=file, data=data)

    db.save(table, data)


@eel.expose
def pending_send_file_tx():
    return db.get('wallet', 'pending_send_file_tx')


@eel.expose
def blockchain_update():
    outdated = server.chain_data_outdated()
    data_exists = server.chain_data_exists()

    if outdated or not data_exists:
        return False
    else:
        return True


# /----------- START SCRIPT FUNCTION -----------/ #
if __name__ == '__main__':
    root_ = Tk()
    screen_height = root_.winfo_screenheight()
    root_.overrideredirect(1)
    root_.destroy()

    if screen_height < 750:
        height = int(screen_height) - 50
    else:
        height = 900
    freeze_support()

    # Define the args
    index = 'templates/base.html'
    kwargs = {'jinja_templates': 'templates',
              'size': (900, height),
              'port': 5454,
              'close_callback': close_process(['epic-wallet.exe', 'ngrok.exe'])}

    logger.info(f'Starting process monitor')
    p_manager.run_monitor()

    # Operating system and browser check
    if sys.platform in ['win32', 'win64']:
        logger.info(f"APP: RUNNING ON {sys.platform}")
        try:
            eel.start(index, **kwargs)
        except Exception as e:
            logger.critical(e)
            kwargs['mode'] = 'edge'
            eel.start(index, **kwargs)

    elif sys.platform in ["linux", "linux2"]:
        logger.info(f"APP: RUNNING ON {sys.platform}")
        # TODO: LOGIC FOR LINUX
        pass

    elif platform == "darwin":
        logger.info(f"APP: RUNNING ON {sys.platform}")
        # TODO: LOGIC FOR MAC OS
        pass

    else:
        try:
            eel.start(index, **kwargs)
        except Exception:
            logger.exception(f'')
