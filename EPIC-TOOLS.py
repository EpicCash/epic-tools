from tkinter.filedialog import askopenfilename
from tkinter import Tk
import fileinput
import sys
import eel

eel.init('web')


@eel.expose
def edit_server_toml(file_path):
    preferred = 'peers_preferred ='
    preferred_correct = '# ADDED BY EPIC-TOOLS\npeers_preferred = ["90.218.190.248:3414", "52.205.206.130:3414", "24.6.179.23:3414", "54.91.197.13:3414"]\n'
    deny = 'peers_deny ='
    deny_correct = '# ADDED BY EPIC-TOOLS\npeers_deny = ["121.5.180.139:3414", "54.152.40.176:3414", "51.89.98.17:3414"]\n'

    for line in fileinput.input(file_path, inplace=1):
        if preferred in line:
            line = preferred_correct
        elif deny in line:
            line = deny_correct
        sys.stdout.write(line)


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


eel.start('templates/home.html',
          jinja_templates='templates',
          size=(600, 600),
          port=5001)  # Start
