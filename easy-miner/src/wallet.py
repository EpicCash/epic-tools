from fernet import Fernet
from tinydb import Query
import subprocess
import requests
import logging
import random
import json
import re
import os

from . import tools
from .db import db

# Hide CMD windows while using subprocess
si = subprocess.STARTUPINFO()
si.dwFlags |= subprocess.STARTF_USESHOWWINDOW

# Logging setup
logging.basicConfig(filename='app.log', format='%(asctime)s %(levelname)s %(message)s',
                    datefmt='%m/%d/%Y %I:%M:%S %p', encoding='utf-8', level=logging.INFO)


class Wallet:
    """Class to manage epic-wallet operations"""

    def __init__(self, file_name, cwd, pool):
        self.file_name = file_name
        self.pool = pool
        self.cfg = {
            'listener_port': 3415,
            'node_port': 3413
            }
        self.cwd = cwd
        self.q = {'created': Query().type == 'wallet_created',
                  'password': Query().type == 'wallet_password',
                  'fernet_key': Query().type == 'key'}
        self.nodes = {'local': f"http://127.0.0.1:{self.cfg['node_port']}",
                      'fastepic': 'https://fastepic.eu:3413',
                      'epicradar': 'https://epicradar.tech/node'}

    @staticmethod
    def ext_ip():
        import requests
        try:
            return requests.get('https://checkip.amazonaws.com').text.strip()
        except Exception as e:
            print(e)
            return None

    def created(self):
        """ Checking in database if wallet was already created """
        return db.get(self.q['created'])['value']

    def _fernet_key(self):
        return db.get(self.q['fernet_key'])['value']

    def _get_node(self):
        # If server is running use local node, else use random outside node
        random_node = random.choice([v for k, v in self.nodes.items()
                                     if k != 'local'])
        if tools.check_process('epic.exe'):
            return self.nodes['local']
        else:
            return random_node

    def _execute(self, args):
        """Execute basic wallet commands through subprocess (synchronous)"""
        password = self._decrypt_password()
        file = os.path.join(self.cwd, self.file_name)
        node = self._get_node()
        basic_args = [file, "-p", f"{password}", "-r", node]
        all_args = basic_args + args

        process = subprocess.run(all_args, cwd=self.cwd, startupinfo=si,
                                 stderr=subprocess.STDOUT, stdout=subprocess.PIPE)
        return process

    def _decrypt_password(self):
        key = Fernet(self._fernet_key().encode('utf-8'))
        password = db.get(self.q['password'])['value'].encode('utf-8')
        return key.decrypt(password).decode('utf-8')

    def listener_running(self):
        return tools.check_process(self.file_name)

    def create(self, password):
        # Save encrypted password to database
        tools.save_pass(password)

        # Run epic-wallet init command and create config file
        process = self._execute(["init", "-h"])
        stdout = str(process.stdout)

        if 'successfully' in stdout:
            # If creation succeed find line with seed phrase in stdout
            lines = str(process.stdout).split('\\n')
            for i, line in enumerate(lines):
                print(len(line.split(' ')))
                if len(line.split(' ')) == 24:
                    print(i, '--------', line)
                    db.update({'value': True}, self.q['created'])
                    return f"{lines[5]}"

            # If can't find specific line, show user whole stdout (messy)
            db.update({'value': True}, self.q['created'])
            return '\\n'.join(lines)

        # todo: better handling existing wallet files (for whatever reason)
        elif 'already exists' in stdout:
            # There was already wallet.seed or epic-wallet.toml file
            db.update({'value': True}, self.q['created'])
            logging.info(stdout)
            return False

        else:
            logging.warning(stdout)
            return False

    def run_listener(self):
        """Execute wallet listener to receive mining yield or transactions,
           it's subprocess.Popen working in the background"""

        file = os.path.join(self.cwd, self.file_name)
        password = self._decrypt_password()
        running = self.listener_running()

        if running:
            process = running
        else:
            process = subprocess.Popen([file, "-p", f"{password}", "listen"],
                                       stderr=subprocess.STDOUT,
                                       stdout=subprocess.PIPE,
                                       startupinfo=si, cwd=self.cwd)
            stdout = str(process.stdout)
            logging.info(process.stdout)

            if "Wallet seed file doesn't exist" in stdout:
                db.update({'value': False}, self.q['created'])
                logging.warning(stdout)
                return False

        logging.info('Listener running')
        self.pool.add(self.file_name, process.pid)
        return True

    def balance(self):
        b = []
        msg = None

        def usd_value():
            url = "https://api.coingecko.com/api/v3/simple/price?ids=epic-cash&vs_currencies=usd"
            return json.loads(requests.get(url).content.decode('utf-8'))['epic-cash']['usd']

        try:
            # Execute info command
            process = self._execute(['info'])
            stdout = str(process.stdout)
            logging.info(stdout)

            # Search for balance values in process.stdout
            for line in stdout.split('\n'):
                patter = r"\d+.\d+"
                match = re.findall(patter, line)
                if match:
                    print(match)
                    b.append(match)

            try:
                from setuptools._vendor import more_itertools
                b = [n for n in list(more_itertools.collapse(b))]
            except Exception as e:
                logging.warning(e)
                b = [0 for x in range(8)]


            if 'failed' in stdout:
                msg = "Can't connect to wallet"
                print(msg)
                logging.warning(msg)
                b = b[4:]

            elif 'Please wait for sync' in stdout:
                msg = f'Server is synchronizing, please wait'
                print(msg)
                logging.warning(msg)
                b = b[6:]

            balances = {
                'total': float(b[-5]),
                'wait_conf': float(b[-4]),
                'wait_final': float(b[-3]),
                'locked': float(b[-2]),
                'spendable': float(b[-1]),
                'usd_value': f"{round(usd_value() * float(b[-5]), 2)} USD",
                'height': b[0]
                }
            return balances, msg

        except Exception as e:
            print(e)
            return None, "Can't connect to wallet"

    def send(self, address):
        success = False
        msg = None

        balance = self.balance()
        amount = balance[0]['spendable']

        if not balance[1]:
            process = self._execute(["send", "-d", f"{address}", f"{amount}"])
            stdout = str(process.stdout)
            print(stdout)

            if 'completed successfully' in stdout:
                success = True

            elif 'is recipient listening?' in stdout:
                msg = f"Listener address is unavailable"
                logging.warning(msg)
                print(msg)

            elif 'Not enough funds' in stdout:
                msg = f"Not enough funds to withdraw"
                logging.warning(msg)
                print(msg)

            elif 'Please wait for sync' in stdout:
                msg = f"Server is synchronizing, please wait"
                logging.warning(msg)
                print(msg)

        else:
            msg = balance[1]
            print(msg)
            logging.warning(msg)

        return success, msg

    def show_seed_phrase(self):
        pass

    # def backup_data(self, remove=False):
    #     cwd = os.path.join(os.getcwd(), "epic-server")
    #
    #     dirs = [[f.name, f.path] for f in os.scandir(chain_data)
    #             if f.is_dir() and f.name in to_copy]

