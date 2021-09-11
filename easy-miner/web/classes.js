var spinner = '<div class="spinner-border spinner-border-sm" role="status"></div>'

class QuickMining {
    constructor(funcList) {
        this.working = 0
        this.funcList = funcList
        this.btn = $('#start_mining')
        this.btn_icon = $('#start_mining_icon')
        this.btn_spinner = $('#start_mining_spinner')
        this.btn_start_mining_text = $('#start_mining_text')
    }

    startProc() {
        if (!this.working) {
            this.btn_spinner.removeClass('hidden')
            $('.top-body').removeClass('hidden')
            $('#wallet_created_screen').addClass('hidden')
            this.working = 1
            this.funcList.forEach(function (func, index) {
                window["start" + func]();
            });
            this.startGUI()
        }
    }

    startGUI() {
        this.working = 1
        this.btn_spinner.addClass('hidden')
        this.btn.removeClass('btn-success')
        this.btn.addClass('btn-warning')
        this.btn_start_mining_text.text('Stop Mining')
        this.btn_icon.html('<span class="material-icons">pause_circle</span>')
        this.btn.attr("onClick", "qckMining.stopProc()")
    }

    stopProc() {
        if (this.working) {
            this.working = 0
            this.btn_spinner.removeClass('hidden')
            this.funcList.forEach(function (func, index) {
                if (func === "CPU" || func === "GPU") {
                    window["stop" + func]();
                }
            });
            this.stopGUI()
        }
    }

    stopGUI() {
        this.working = 0
        this.btn_spinner.addClass('hidden')
        this.btn.removeClass('btn-warning')
        this.btn.addClass('btn-success')
        this.btn_start_mining_text.text('Quick Mining')
        this.btn_icon.html('<span class="material-icons">play_circle_filled</span>')
        this.btn.attr("onClick", "qckMining.startProc()")
    }
}

class EpicProcess {
    constructor(btn, icon, status, stopFnc, startFnc, process) {
        this.btn = btn
        this.icon = icon
        this.status = status
        this.working = 0
        this.process = process
        this.stopFnc = stopFnc
        this.startFnc = startFnc
    }

    // Function to START process
    startProc() {
        if (!this.working) {
            this.startFnc()
            this.working = 1
            this.startGUI()
        }
    }

    // Function to change GUI on START
    startGUI() {
        this.working = 1
        this.btn.removeClass('btn-success')
        this.btn.addClass('btn-warning')
        this.btn.html('Stop')
        this.changeBtnFunc('stop')
        this.changeIcon('online')
        this.status.html('<span class="fs-5 material-icons align-middle text-success">play_circle_outline</span> <span class="align-middle"> Working<span>')
    }

    // Function to STOP process
    stopProc() {
        if (this.working) {
            this.stopFnc()
            this.working = 0
            this.stopGUI()
        }
    }

    // Function to change GUI on STOP
    stopGUI() {
        this.working = 0
        this.btn.removeClass('btn-warning')
        this.btn.addClass('btn-success')
        this.btn.html('Start')
        this.changeBtnFunc('start')
        this.changeIcon('offline')
        this.status.html('<span class="fs-6 material-icons align-middle text-warning">stop_circle</span> <span class="align-middle"> Stopped<span>')
    }

    // Function to change indicator of process (green/red/yellow dot)
    changeIcon(toggle) {
        if (toggle === 'online') {
            this.icon.removeClass('offline error sync')
            this.icon.addClass('online')
        } else if (toggle === 'sync') {
            this.icon.removeClass('offline error online')
            this.icon.addClass('sync')
        } else {
            this.icon.removeClass('online offline sync')
            this.icon.addClass('offline')
        }
    }

    // Function to change onclick attr of button
    changeBtnFunc(toggle) {
        if (toggle === 'start') {
            this.btn.attr("onClick", this.process + ".startProc()")
        } else {
            this.btn.attr("onClick", this.process + ".stopProc()")
        }
    }
}
