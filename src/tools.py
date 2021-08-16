from copy import deepcopy
from fernet import Fernet
from tinydb import Query
from pathlib import Path
from .db import db
import subprocess
import fileinput
import binascii
import hashlib
import psutil
import socket
import sys
import os


def edit_server_toml(file_path):
    preferred = 'peers_preferred ='
    preferred_correct = 'peers_preferred = ["90.218.190.248:3414", "52.205.206.130:3414", "24.6.179.23:3414", "54.91.197.13:3414"]\n'
    deny = 'peers_deny ='
    deny_correct = 'peers_deny = ["121.5.180.139:3414", "54.152.40.176:3414", "51.89.98.17:3414"]\n'

    for line in fileinput.input(file_path, inplace=1):
        if preferred in line and line != preferred_correct:
            line = preferred_correct
        elif deny in line and line != deny_correct:
            line = deny_correct
        sys.stdout.write(line)


def hash_password(password):
    """Hash a password for storing."""
    salt = hashlib.sha256(os.urandom(60)).hexdigest().encode('ascii')
    pwdhash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'),
                                  salt, 100000)
    pwdhash = binascii.hexlify(pwdhash)
    return (salt + pwdhash).decode('ascii')


def verify_password(stored_password, provided_password):
    """Verify a stored password against one provided by user"""
    salt = stored_password[:64]
    stored_password = stored_password[64:]
    pwdhash = hashlib.pbkdf2_hmac('sha512',
                                  provided_password.encode('utf-8'),
                                  salt.encode('ascii'),
                                  100000)
    pwdhash = binascii.hexlify(pwdhash).decode('ascii')
    return pwdhash == stored_password


def save_pass(password):
    Password = Query().type == 'wallet_password'
    key = db.get(Query().type == 'key')['value']
#     # print(key)
    key = Fernet(key.encode('utf-8'))
    db.upsert({'type': 'wallet_password',
               'value': key.encrypt(password).decode('utf-8')}, Password)


def open_port(port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', port))
    if result == 0:
        sock.close()
        return True
    else:
        sock.close()
        return False


class ProcessPool:
    def __init__(self):
        self.list = {}

    def get_or_run(self, process_name, cwd):
        running = check_process(process_name)
        # print(process_name)
        if running:
            process = running
            # print(f'PROCESS FOUND: {process}')
        else:
            process = subprocess.Popen(f'start {process_name}', cwd=cwd, shell=True)

        self.add(process_name, process.pid, running=True)
        # print(self.list)
        return process

    @staticmethod
    def read_db():
        data = db.search(Query().type == 'proc_list')
        return data[0]['value']

    def save_db(self, clear=False):
        if not clear:
            db.upsert({'type': 'proc_list', 'value': self.list},
                      Query().type == 'proc_list')
        else:
            db.upsert({'type': 'proc_list', 'value': False},
                      Query().type == 'proc_list')

    def add(self, proc, pid, running=True):
        self.list[proc] = {'pid': pid, 'running': running}
        self.save_db()

    def kill(self, proc=False, all=False):
        if proc and not all:
            kill_process(proc)
            try: del self.list[proc]
            except: pass
            self.save_db()
        else:
            for p in deepcopy(self.list):
                kill_process(p)
                del self.list[p]
            self.save_db()


def check_process(name):
#     # print(name)
    # Iterate over the all the running process
    for process in psutil.process_iter():
        try:
            # Check if process name contains the given name string.
            if str(name) in process.name():
                return process
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return False


def kill_process(process):
    if isinstance(process, psutil.Process):
        try:
            process.kill()
            # return print(f"(PID:{process.ppid()}) {process.name()} is closed")

        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess) as er:
            # print(er)
            pass
    else:
        for proc in psutil.process_iter():
            if (proc.name() == process) \
                or (proc.pid == process):
                try:
                    proc.kill()
                    # return print(f"(PID:{proc.ppid()}) {proc.name()} is closed")
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess) as er:
                    # print(er)
                    pass


def get_directory_size(directory):
    root_directory = Path(directory)
    size = sum(f.stat().st_size for f in root_directory.glob('**/*') if f.is_file())

    def humansize(nbytes):
        suffixes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
        i = 0
        while nbytes >= 1024 and i < len(suffixes) - 1:
            nbytes /= 1024.
            i += 1
        f = ('%.2f' % nbytes).rstrip('0').rstrip('.')
        return f, suffixes[i]

    return humansize(size)