var password = ''
var sleepTime = 1500
var spinner = '<div class="spinner-border spinner-border-sm" role="status"></div>'
var poolUpdaterWorking = 0

// Check if wallet is already created or it is first time
isWallet()

// Check for user hardware details
hardwareInfo()

// Get blockchain height from explorer.epic.tech API
blockchainHeight()

async function greet() {
    var greetings = await eel.greetings()()
    console.log(greetings)
    send_console(greetings)
}

function copyToClipboard(element) {
    var $temp = $("<input>");
    $("body").append($temp);
    $temp.val($(element).text()).select();
    document.execCommand("copy");
    $temp.remove();
}

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
        await sleep(3000)
        send_console('Clearing peers completed!', remove=1)
    }
}

async function checkChainData() {
    restoreFixModal()
    var isBackup = await eel.first_backup()()
    var restore_button = $('#confirm_restore_btn')
    console.log(isBackup)
//    if (isBackup) {
//        restore_button.removeClass('hidden')
//    }
}

async function restoreChainData() {
    send_console('Restoring chain_data... ' + spinner)
    var upload_button = $('#upload_dir_btn')
    var restore_button = $('#confirm_restore_btn')
    restore_button.addClass('hidden')

    var data = await eel.restore_chain_data()()
    if (data) {
        await sleep(2000)
        send_console('Restoring completed!', remove=1)
        $('#db_fix_help').html("✅  Chain data updated successfully.")
        $('#exit_btn').removeClass('hidden')
    } else {
        $('#db_fix_help').html("⚠️ Problems with local backup, please use different source.")
    }
}

async function uploadChainData() {
    var upload_button = $('#upload_dir_btn')
	upload_button.html(upload_button.get(0).innerText + ' ' + spinner)

    var chain_data = await eel.upload_chain_data()()

	if (chain_data) {
	    send_console('Restoring completed!', remove=1)
		$('#db_fix_help').html("✅   Chain data updated successfully.")
		upload_button.addClass('hidden')
		$('#exit_btn').removeClass('hidden')
	} else {
	    $('#db_fix_help').html("⚠️ Problems with this source, please select <code>chain_data</code> directory.")
	    upload_button.html("Wrong chain_data directory, try again")
	}
}

function restoreFixModal() {
    $('#upload_dir_btn').html('Upload new chain_data')
	$('#upload_dir_btn').removeClass('hidden')
    $('#exit_btn').addClass('hidden')
    $('#db_fix_help').html("")
}

async function isWallet() {
    var created = await eel.is_wallet()()

    if (!created) {
        send_console('To start mining please create wallet')
        $('.software_tabs').addClass('hidden')
        $('.software_content').addClass('hidden')
        $('#create_wallet_screen').toggleClass('hidden')
        $('#mining_screen').addClass('hidden')
        $('#create_wallet_screen').removeClass('hidden')
        $('#wallet_created_screen').addClass('hidden')
    } else {
        $('.top-body').removeClass('hidden')
        walletBalance()
        greet()
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
        creation_response.html(spinner)
        wallet_created_screen.removeClass('hidden')

        var response = await eel.create_wallet(pass1)()
        if (response) {
            send_console('Please backup in non-digital form your seed phrase:', remove=1)
            creation_response.html(response)
            $('.software_tabs').removeClass('hidden')
            $('.software_content').removeClass('hidden')
        } else {
            send_console('Wallet already exists', remove=1)
            wallet_created_screen.addClass('hidden')
            $('.top-body').removeClass('hidden')
            $('.software_tabs').removeClass('hidden')
            $('.software_content').removeClass('hidden')
        }
    }
}

function cleanBalances(val='') {
    $('#wait_conf').html(val)
    $('#locked').html(val)
    $('#spendable').html(val)

    if (val === '') {
        $('#wallet_height').html(val)
        $('#usd_value').html(val)
        $('#total').html(val)
        $('#wallet_response').html(val)
    }
}

async function walletBalance() {
    $('#wallet_refresh_btn').addClass('fa-spin')
    cleanBalances(val=spinner)
    var balance = await eel.wallet_balance()()
    if (balance[0]) {
        $('#wallet_height').html(balance[0].height.toLocaleString('en-US'))
        $('#total').html(balance[0].total.toFixed(4))
        $('#wait_conf').html(balance[0].wait_conf.toFixed(4))
        $('#locked').html(balance[0].locked.toFixed(4))
        $('#spendable').html(balance[0].spendable.toFixed(4))
        $('#usd_value').html(balance[0].usd_value)
    }
    $('#wallet_refresh_btn').removeClass('fa-spin')
}

async function walletData() {
    $("#listenerIP").html('')
    var data = await eel.wallet_data()()

    if (data.ext_ip) {
        $("#listenerIP").html("<a id='ip_link' href='#' class='text-dark' data-bs-toggle='tooltip' data-bs-placement='top' title='Click to copy'>" + data.ext_ip + '</a>');
        $("#listenerIP").attr("onClick", "copyToClipboard($('#ip_link'))")
        $("#listenerPort").text(data.port)
        if (data.open_port) {
            $("#listenerPortCheck").html("<span class='fs-6 indicator online' data-bs-toggle='tooltip' data-bs-placement='top' title='Port is open'></span>")
        } else {
            $("#listenerPortCheck").html("<span class='fs-6 indicator offline' data-bs-toggle='tooltip' data-bs-placement='top' title='Port is closed'></span>")
        }
    }
}

async function withdrawFromWallet() {
    wallet_console = $('#wallet_help')
    wallet_console.text('')
    var address = $('#address').val()

    if (address) {
        wallet_console.html(spinner)
        var response = await eel.withdraw_from_wallet(address)()

        if (response[1]) {
            wallet_console.text('⚠️ ' + response[1])
        } else {
            wallet_console.text('✅    Success!')
            walletBalance()
        }
    } else {
        wallet_console.text('⚠️ Please provide recipient address')
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
    if (remove) {
        await sleep(5000)
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

async function chainCheck() {
    var chainDataExists = await eel.chain_data_exists()()
    var outdated = await eel.chain_data_outdated()()

    if (!chainDataExists || outdated) {
        send_console("No <u>chain_data</u> directory found, or it's greatly outdated. You can restore/upload from snapshot or continue to synchronize from block 0 (may take several hours)")
    }
}

// Function to START epic.exe server
async function startServer() {
    $('#wallet_created_screen').addClass('hidden')
    $('.top-body').removeClass('hidden')

    chainCheck()
    await startListener()
    await eel.start_server()
    changeBtnFunc($('#serverButton'), 'stop')
    changeBtn($('#serverButton'), 'stop')
    changeIcon($('#serverIcon'), 'online')
    changeStatus($('#serverStatus'), 'Working..')
    changeBtn($('#serverButton'), 'stop')
    rollbackCheck()
    poolUpdater(3000)
    await sleep(3000)
    await nodeData()
    await walletBalance()
}

// Function to STOP epic.exe server
async function stopServer() {
    eel.close_process('epic.exe')
    await sleep(1000)
    $('#serverSize').html('')
    $('#serverPeers').html('')
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
    await walletData()
}

// Function to STOP epic-wallet.exe
async function stopListener() {
    eel.close_process('epic-wallet.exe')
    changeBtnFunc($('#listenerButton'), 'start')
    changeBtn($('#listenerButton'), 'start')
    changeIcon($('#listenerIcon'), 'offline')
    changeStatus($('#listenerStatus'), 'Stopped')
    $("#listenerIP").html('')

}

async function poolUpdater(time) {
    if (!poolUpdaterWorking) {
        poolUpdaterWorking = 1
        while (true) {
            obj = await eel.pool_updater()()
            obj.forEach(function (item, index) {
                functionName = item;
                window[functionName]();
            });
            await sleep(time)
        }
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

async function nodeData() {
    var data = await eel.node_data()()
    var size = await eel.blockchain_size(str=true)()
    if (data) {
        $('#serverPeers').html(data.connections)
        $('#serverSize').html(size)
    }
}

eel.expose(stopMining)
async function stopMining() {
    var btn = $('#start_mining')
    var btn_spinner = $('#start_mining_spinner')
    var btn_icon = $('#start_mining_icon')
    send_console('Mining software is stopped', remove=1)

    btn_spinner.removeClass('hidden')
    await stopCPU()
    await stopGPU()
    await sleep(3000)
    btn_spinner.addClass('hidden')
    btn.removeClass('btn-warning')
    btn.addClass('btn-success')
    $('#start_mining_text').text('Quick Mining')
    btn_icon.html('<span class="material-icons">play_circle_filled</span>')
    btn.attr("onClick", "startAll()")
}

async function startAll() {
    send_console('')
    $('.top-body').removeClass('hidden')
    $('#wallet_created_screen').addClass('hidden')
    var btn = $('#start_mining')
    var btn_spinner = $('#start_mining_spinner')
    var btn_icon = $('#start_mining_icon')
    btn_spinner.removeClass('hidden')

    // Check if there is existing db_backup
    var firstBackup = await eel.first_backup()()

    // Check if there is chain_data folder
    chainCheck()

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
        btn_spinner.addClass('hidden')
        btn.removeClass('btn-success')
        btn.addClass('btn-warning')
        $('#start_mining_text').text('Stop Mining')
        btn_icon.html('<span class="material-icons">pause_circle</span>')
        btn.attr("onClick", "stopMining()")
        poolUpdater(3000)

    } else {
        isWallet()
    }
}

async function hardwareInfo() {
    var cpu = await eel.get_cpu()()
    var gpu = await eel.get_gpu()()
    $('#cpu_info').html("<a class='a-link' href='" + cpu.link + "' target='_blank'>" + cpu.string + "</a>")
    $('#gpu_info').html("<a class='a-link' href='" + gpu.link + "' target='_blank'>" + gpu.string + "</a>")
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

