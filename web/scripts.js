var password = ''
var sleepTime = 1500
var spinner = '<div class="spinner-border spinner-border-sm" role="status"></div>'


// Check if wallet is already created or it is first time
isWallet()

// Check for user hardware details
hardwareInfo()

// Get blockchain height from explorer.epic.tech API
blockchainHeight()


function callback(current_time){
    document.getElementById("output").innerText=current_time
};
function thetime(){
    eel.thetime()(callback)
}

async function blockchainHeight() {
    var height = await eel.get_height()()
    $('#blockchainHeight').text(height)
}

async function backupDB() {
    send_console('Making backup of chain data... ' + spinner)
    var backup = await eel.backup_db()()
    if (backup) {
        await sleep(2000)
        send_console('Backup completed!', remove=1)
    }
}

async function removePeers() {
    send_console('Clearing peers... ' + spinner)
    var peers = await eel.remove_peers()()
    if (peers) {
        await sleep(5000)
        send_console('Clearing peers completed!', remove=1)
    }
}

async function restoreChainData() {
    send_console('Restoring chain_data... ' + spinner)
    var data = await eel.restore_chain_data()()
    if (data) {
        await sleep(5000)
        send_console('Restoring completed!', remove=1)
    }
}

async function isWallet() {
    var created = await eel.is_wallet()()
    var create_wallet_screen = $('#create_wallet_screen')
    var btn_mine = $('#start_mining')

    if (!created) {
        create_wallet_screen.toggleClass('hidden')
        send_console('To start mining please create wallet')
        $('#start_mining').addClass('hidden')
        $('#mining_screen').addClass('hidden')
        $('#create_wallet_screen').removeClass('hidden')
        $('#wallet_created_screen').addClass('hidden')
    } else {
        $('#other_buttons').removeClass('hidden')
        send_console('')
        btn_mine.removeClass('hidden')
//        startAll()
    }
}

async function createWallet() {
    var pass1 = $('#password').val()
    var pass2 = $('#password2').val()
    var btn_mine = $('#start_mining')
    var creation_response = $('#creation_response')
    var create_wallet_screen = $('#create_wallet_screen')
    var wallet_created_screen = $('#wallet_created_screen')
    if (!pass1) {
        send_console('Please provide password')
    } else if (pass1 !== pass2) {
        send_console('Passwords must be the same')
    } else {
        send_console('')
        create_wallet_screen.addClass('hidden')
        wallet_created_screen.removeClass('hidden')
        var response = await eel.create_wallet(pass1)()
        if (response) {
            send_console('Please backup in non-digital form your seed phrase:')
            creation_response.html(response)
            btn_mine.removeClass('hidden')
        } else {
            send_console('Wallet already exists', remove=1)
            wallet_created_screen.addClass('hidden')
            btn_mine.removeClass('hidden')
        }
    }
}


function cleanBalances() {
    $('#balances_response').addClass('hidden')
    var val = ''
    $('#total').html(val)
    $('#wait_conf').html(val)
    $('#locked').html(val)
    $('#spendable').html(val)
    $('#wallet_response').html(val)
}

async function walletBalance() {
    cleanBalances()
    $('#wallet_response').html(spinner)
    if (await eel.is_running('epic.exe')()) {
        var balance = await eel.wallet_balance()()
        if (balance) {
            $('#wallet_height').html(balance.height)
            $('#balances_response').removeClass('hidden')
            $('#total').html(balance.total)
            $('#wait_conf').html(balance.wait_conf)
            $('#locked').html(balance.locked)
            $('#spendable').html(balance.spendable)
            $('#wallet_response').html('')
        }
    } else {
        $('#wallet_response').html('')
        $('#wallet_response').html('To check wallet balance please start Server (epic.exe) first.')
        send_console('To check wallet balance please start Server (epic.exe) first.', remove=1)
    }
}

function changeBtn(btn, toggle) {
    if (toggle === 'start') {
        btn.removeClass('btn-warning')
        btn.addClass('btn-success')
        btn.text('Start')
    } else {
        sleep(sleepTime)
        btn.removeClass('btn-success')
        btn.addClass('btn-warning')
        btn.text('Stop')
    }
}

function changeIcon(icon, toggle) {
    if (toggle === 'online') {
        icon.removeClass('offline error sync')
        icon.addClass('online')
    } else if (toggle === 'sync') {
        icon.removeClass('offline error online')
        icon.addClass('sync')
    } else {
        icon.removeClass('online offline sync')
        icon.addClass('error')
    }
}

function changeStatus(status, text) {
    status.text(text)
}

async function send_console(msg, remove=0) {
    $('#console').html(msg)
    await sleep(5000)
    if (remove) {
        $('#console').html('')
    }
}

function changeBtnFunc(btn, toggle) {
    if (toggle === 'start') {
        btn.attr("onClick", "start"+btn.attr('name')+"()")
    } else {
        btn.attr("onClick", "stop"+btn.attr('name')+"()")
    }
}

// Function to START epic.exe server
async function startServer() {
    $('#start_mining').addClass('hidden')
    $('#mining_screen').removeClass('hidden')
    await eel.start_server()
    changeBtnFunc($('#serverButton'), 'stop')
    changeBtn($('#serverButton'), 'stop')
    changeIcon($('#serverIcon'), 'online')
    changeStatus($('#serverStatus'), 'Working..')
    changeBtn($('#serverButton'), 'stop')
    rollbackCheck()
}

// Function to STOP epic.exe server
async function stopServer() {
    eel.close_process('epic.exe')
    changeBtnFunc($('#serverButton'), 'start')
    changeBtn($('#serverButton'), 'start')
    changeIcon($('#serverIcon'), 'error')
    changeStatus($('#serverStatus'), 'Stopped')
    send_console('')

}

// Function to START epic-miner-cpu.exe
async function startCPU() {
    await eel.start_cpu_miner()()
    changeBtnFunc($('#cpuButton'), 'stop')
    changeBtn($('#cpuButton'), 'stop')
    changeIcon($('#cpuIcon'), 'online')
    changeStatus($('#cpuStatus'), 'Mining..')
}

// Function to STOP epic-miner-cpu.exe
async function stopCPU() {
    eel.close_process('epic-miner-cpu.exe')
    changeBtnFunc($('#cpuButton'), 'start')
    changeBtn($('#cpuButton'), 'start')
    changeIcon($('#cpuIcon'), 'offline')
    changeStatus($('#cpuStatus'), 'Stopped')
}

// Function to START epic-miner-gpu.exe
async function startGPU() {
    await eel.start_gpu_miner()()
    changeBtnFunc($('#gpuButton'), 'stop')
    changeBtn($('#gpuButton'), 'stop')
    changeIcon($('#gpuIcon'), 'online')
    changeStatus($('#gpuStatus'), 'Mining..')
}

// Function to STOP epic-miner-gpu.exe
async function stopGPU() {
    eel.close_process('epic-miner-gpu.exe')
    changeBtnFunc($('#gpuButton'), 'start')
    changeBtn($('#gpuButton'), 'start')
    changeIcon($('#gpuIcon'), 'offline')
    changeStatus($('#gpuStatus'), 'Stopped')
}

// Function to START epic-wallet.exe with listening arg
async function startListener() {
    await eel.start_listener()()
    changeBtnFunc($('#listenerButton'), 'stop')
    changeBtn($('#listenerButton'), 'stop')
    changeIcon($('#listenerIcon'), 'online')
    changeStatus($('#listenerStatus'), 'Listening..')
}

// Function to STOP epic-wallet.exe
async function stopListener() {
    eel.close_process('epic-wallet.exe')
    changeBtnFunc($('#listenerButton'), 'start')
    changeBtn($('#listenerButton'), 'start')
    changeIcon($('#listenerIcon'), 'offline')
    changeStatus($('#listenerStatus'), 'Stopped')
}

async function poolUpdater(time) {
    while (true) {
        obj = await eel.pool_updater()()
        obj.forEach(function (item, index) {
            functionName = item;
            window[functionName]();
        });
        await sleep(time)
    }
}

async function rollbackCheck() {
    if (await eel.rollback_check()()) {
            changeStatus($('#serverStatus'), 'Downloading..')
            changeIcon($('#serverIcon'), 'sync')
            send_console('Downloading Epic-Cash blockchain (may take up to 2 hours)... Please restart when finished')
            stopGPU()
            stopCPU()
    } else {
        return false
    }

}

async function startAll() {
    send_console('')
    $('#wallet_created_screen').addClass('hidden')
    $('#start_mining').html('Start Quick-Mining ' + spinner)

    // Check if there si existing db_backup
    var firstBackup = await eel.first_backup()()

    // If listener will start, means wallet is working
    // and we can start mining
    if (startListener()) {
        var rollback = await eel.rollback_check()()
        if (!rollback) {
            if (!firstBackup) {
                backupDB()
            }
            await startGPU()
            await startCPU()
        }
        await startServer()
        $('#other_buttons').removeClass('hidden')
        poolUpdater(5000)

    } else {
        isWallet()
    }
}

async function hardwareInfo() {
    var cpu = await eel.get_cpu()()
    var gpu = await eel.get_gpu()()
    $('#cpu_info').html("<a href='" + cpu.link + "' target='_blank'>" + cpu.string + "</a>")
    $('#gpu_info').html("<a href='" + gpu.link + "' target='_blank'>" + gpu.string + "</a>")
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//async function getFile() {
//var file_path = await eel.upload_file()();
//var button = $('#upload_file')
//	if (file_path) {
//		console.log(file_path);
//		await eel.edit_server_toml(file_path)()
//		button.removeClass("btn-warning")
//		button.addClass("btn-success")
//		button.text("File successfully updated!")
//	} else {
//		button.addClass("btn-warning")
//	    button.text("Wrong file, try again")
//	}
//}