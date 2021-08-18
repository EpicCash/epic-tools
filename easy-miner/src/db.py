from fernet import Fernet
from tinydb import TinyDB
import os.path


if not os.path.isfile('db.json'):
    db = TinyDB('db.json')
    db.insert({'type': 'wallet_created', 'value': False})
    db.insert({'type': 'key', 'value': Fernet.generate_key().decode('utf-8')})
else:
    db = TinyDB('db.json')
