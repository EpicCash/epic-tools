isWallet()
var sleepTime = 1500
var spinner = '<div class="spinner-border spinner-border-sm" role="status"></div>'
var spaceHolder = '<span class="material-icons align-middle text-muted">help_outline</span>'
var lastWalletBalance = 'empty'


// -------- WALLET VARs-- //
var total = parseFloat(0).toFixed(4)
var height = parseFloat(0).toFixed(4)
var locked = parseFloat(0).toFixed(4)
var immature = parseFloat(0).toFixed(4)
var wait_conf = parseFloat(0).toFixed(4)
var spendable = parseFloat(0).toFixed(4)
var usd_value = parseFloat(0).toFixed(4)
var wait_final = parseFloat(0).toFixed(4)



// -------- CHECK IF WALLET EXISTS -- //
eel.expose(walletExists)
function walletExists() {
    $('.on_wallet').removeAttr('hidden')
    $('.pre_wallet').attr('hidden', true)
    startListener()
    chainDataWarning()
    eel.log('1st data collection start')()
    showToast(icon='info', title='Initializing data...'+spinner, position='center', timer=5000)

    // -- START UPDATING WALLET BALANCE EVERY 1 MIN -- //
    updateWalletBalance()
    async function updateWalletBalance() {
        while (true) {
            walletBalance()
            walletTransactions()
            await sleep(1000 * 60)
        }
    }
    eel.log('** DOCUMENT READY **')()
}

eel.expose(walletNotExists)
function walletNotExists() {
    $('.on_wallet').attr('hidden', true)
    $('.pre_wallet').removeAttr('hidden')
}

// -------- CHECK IF CHAIN_DATA EXISTS AND IS RECENT -- //
async function chainDataWarning() {
    var showWarn = await eel.db_get(table='server', key='sync_warning')()
    if (showWarn) {
        var data = await eel.blockchain_update()()
        console.log(data)
        if(!data) {
            Swal.fire({
                icon: 'info',
                title: 'Blockchain synchronization',
                html: "<ul><li>Your blockchain data is empty or very old</li><br />"+
                      "<li>Synchronization may take several hours</li><br />"+
                      "<li>You can use your existing local blockchain data</li><br /><li> You can ask on our "+
                      "<a href='https://t.me/epiccashhelpdesk' target='_blank' class='text-dark fw-bold mr-1'>"+
                      "<i class='fab fa-telegram mr-1'></i>Telegram</a> for help with chain data bootstrap/snapshot</li><ul>",
                showDenyButton: true,
                denyButtonText: "Don't show it again"
            }).then((result) => {
                if (result.isDenied) {
                    saveDB(table='server', data='{"sync_warning": False}')
                    settingsToast()
                }
            })
        }
    }
}

// -------- UPDATE DATA FIELDS -- //
async function otherData() {
    var data = await eel.other_data()()
    $('#blockchainHeight').text(data.current_height)
    $('#cpu_info').html("<a class='a-link' href='" + data.cpu_data.link + "' target='_blank'>" + data.cpu_data.string + "</a>")
    $('#gpu_info').html("<a class='a-link' href='" + data.gpu_data.link + "' target='_blank'>" + data.gpu_data.string + "</a>")
}

// -------- INIT CLASSES AND ASSIGN BUTTON FUNCTIONS -- //
$(document).ready(function(){

    eel.log('DOC READY START')()
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl)
    })

    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    })

    $('#set_wallet_port_input').val(getDB('wallet', 'api_listen_port', 'set_wallet_port_input'))
    $('#save_wallet_port_btn').click(function() {
        var wallet_port = $('#set_wallet_port_input').val()
        saveDB(table='wallet', data='{"api_listen_port": '+wallet_port+'}', toml=true)
        settingsToast()
    });

    $('.use_local_node input').change(function() {
        var use_local_node = $(this).is(':checked')
        if (use_local_node){
            saveDB(table='wallet', data='{"use_local_node": True}', toml=false)
        } else {
            saveDB(table='wallet', data='{"use_local_node": False}', toml=false)
        }
        settingsToast()
    });

    $('.wallet_ip_option input').change(function() {
        var wallet_ip_option = $(this).is(':checked')
        if (wallet_ip_option){
            saveDB(table='wallet', data='{"api_listen_interface ": "0.0.0.0"}', toml=true)
        } else {
            saveDB(table='wallet', data='{"api_listen_interface": "127.0.0.1"}', toml=true)
        }
        settingsToast()
    });

    $(".number-input .minus").click(function() {
        $("#send_amount_input").trigger('change')
     });

    $(".number-input .plus").click(function() {
        $("#send_amount_input").trigger('change')
     });

    // - Modal in modal closing hack
    $("#close_http_help_modal").click(function () {
        $("#http_help_modal").hide();
    });
    $(".open_http_help_modal").click(function () {
        $("#http_help_modal").show();
        $("#http_help_modal").css('opacity', '1');
    });

    // -- Confirm password when sending coins
    var pass_btn = $('#tx_confirm_btn')
    $('#send_password_input').on("keyup change", function(e) {
        if ($(this).val() != '') {
            pass_btn.removeAttr("disabled")
        } else {
            pass_btn.prop("disabled", true)
        }
    });

    // -- Check balance before send
    var button = $('#amount_confirm_btn')
    $('#send_amount_input').on("keyup change", function(e) {
        var maxAmount = parseFloat(lastWalletBalance)
        var amount = $(this).val()
        var accepted = (amount > 0) && (amount <= maxAmount)
        if (accepted) {
            button.html('CONTINUE <span class="material-icons align-center ml-1 fs-5">arrow_forward_ios</span>')
            button.removeAttr("disabled");
        } else {
            button.text('LOW BALANCE')
            button.prop("disabled", true);
        }
    });

    // -- Check recipient address
    $('#send_address_input').on("keyup change", function(e) {
        var address = $(this).val()
        var button = $('#address_confirm_btn')

        if (address != '') {
            button.removeAttr("disabled");
        } else {
            button.prop("disabled", true);
    }});

    // -- Send max amount
    $("#wallet_max_amount").click(function() {
        $("#send_amount_input").val(parseFloat(lastWalletBalance)).trigger('change')
    });

    // -- Drag and move wallet app
    $(function() {
        $('#walletModal').draggable({handle: '.drag-handle'})
    });

    // -- Quick Mining
    qckMining = new QuickMining(
        funcList=['Server', 'Listener', 'CPU', 'GPU'])
    $('#start_mining').attr("onClick", "qckMining.startProc()")

    // -- GPU MINER
    gpuMiner = new EpicProcess(
        btn=$('#gpuButton'),
        icon=$('#gpuIcon'),
        status=$('#gpuStatus'),
        stopFnc=stopGPU,
        startFnc=startGPU,
        process='gpuMiner'
    )
    $('#gpuButton').attr("onClick", "gpuMiner.startProc()")

    // -- CPU MINER
    cpuMiner = new EpicProcess(
        btn=$('#cpuButton'),
        icon=$('#cpuIcon'),
        status=$('#cpuStatus'),
        stopFnc=stopCPU,
        startFnc=startCPU,
        process='cpuMiner'
    )
    $('#cpuButton').attr("onClick", "cpuMiner.startProc()")

    // -- WALLET LISTENER
    epicListener = new EpicProcess(
        btn=$('#listenerButton'),
        icon=$('#listenerIcon'),
        status=$('#listenerStatus'),
        stopFnc=stopListener,
        startFnc=startListener,
        process='epicListener'
    )
    $('#listenerButton').attr("onClick", "epicListener.startProc()")

    // -- EPIC SERVER
    epicServer = new EpicProcess(
        btn=$('#serverButton'),
        icon=$('#serverIcon'),
        status=$('#serverStatus'),
        stopFnc=stopServer,
        startFnc=startServer,
        process='epicServer'
    )
    $('#serverButton').attr("onClick", "epicServer.startProc()")



    // -- START MONITOR PROCESSES AND UPDATE GUI -- //
    eel.log('START MONITOR PROCESS')()

    processMonitor()
    eel.log('STOP MONITOR PROCESS')()

    async function processMonitor() {
    qckMiningBtn = $('#start_mining')
        while (true) {
            otherData()
            var processes = await eel.check_for_mining_soft()()

            if (processes.hasOwnProperty('epic-miner-gpu.exe')) {
                gpuMiner.startGUI()
            } else {
                gpuMiner.stopGUI()
            }

            if (processes.hasOwnProperty('epic-miner-cpu.exe')) {
                cpuMiner.startGUI()
            } else {
                cpuMiner.stopGUI()
            }

            if (processes.hasOwnProperty('epic-miner-cpu.exe') || processes.hasOwnProperty('epic-miner-gpu.exe')) {
                qckMining.startGUI()
            } else {
                qckMining.stopGUI()
            }

            if (processes.hasOwnProperty('epic-wallet.exe')) {
                epicListener.startGUI()
                 $("#receive_listener_feedback").attr('hidden', true)
                walletData()
            } else {
                epicListener.stopGUI()
                $("#receive_listener_feedback").removeAttr('hidden')
                $(".listenerIP").html(spaceHolder)
                $(".listenerPort").html(spaceHolder)
                $(".listenerPortCheck").html('')
            }

            if (processes.hasOwnProperty('epic.exe')) {
                $('#wallet_created_screen').addClass('hidden')
                nodeData()
                epicServer.startGUI()
            } else {
                epicServer.stopGUI()
                    $('#serverHeight').html(spaceHolder)
                    $('#serverPeers').html(spaceHolder)
                    $('#serverSize').html(spaceHolder)
            }
            await sleep(2000)
        }
    }
    eel.log('DOC READY END')()
});

async function backupDB() {
    Swal.fire({
        icon: 'info',
        title: 'Database Backup',
        html: 'Preparing files... <h3>'+spinner+'</h3',
        showCloseButton: false,
        showConfirmButton: false,
    })
    var backup = await eel.backup_db()()
    if (backup) {
        Swal.fire({
            icon: 'success',
            title: 'Database Backup',
            html: 'Finished successfully!',
        })
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'Database Backup',
            html: 'Backup failed',
        })
    }
}

async function removePeers() {
    showToast(icon='info', title='Clearing peers...', timer=8000)
    var peers = await eel.remove_peers()()
    if (peers) {
        showToast(icon='success', title='Clearing peers completed!', timer=2000)
    } else {
       showToast( icon='error', title='Clearing peers failed', timer=2000)
    }
}

async function uploadChainData() {
    const { value: path } = await Swal.fire({
        title: 'Upload New Database',
        showCancelButton: true,
        html: 'Please select and upload valid <code>chain_data</code> directory.',
        confirmButtonText: 'Upload Database',
    })

    if (path) {
        Swal.fire({icon: 'info', title: 'Processing...', html: '<h3>'+spinner+'</h3>', showConfirmButton: false})
        var data = await eel.upload_chain_data()()
        if (data) {
            Swal.fire({icon: 'success', title: 'Restoring completed!'})
        } else {
            Swal.fire({icon: 'error', title: 'Problems with this source, operation failed'})
        }
    }

}

function restoreFixModal() {
    $('#upload_dir_btn').html('Upload new chain_data')
	$('#upload_dir_btn').removeClass('hidden')
    $('#exit_btn').addClass('hidden')
    $('#db_fix_help').html("")
}

async function createWallet() {
    var pass1 = $('#password').val()
    var pass2 = $('#password2').val()
    var username = $('#username').val()
    if (!pass1) {
        showToast( icon='warning', title='Please provide password')
    } else if (pass1 !== pass2) {
        showToast( icon='warning', title='Passwords must be the same')
    } else if (!username) {
        showToast( icon='warning', title='Please provide username')
    } else {
        $('#wallet_create_password').attr('hidden', true)
        Swal.fire({icon: 'info', title: 'Creating account...',
                   html: '<h3>'+spinner+'</h3>',
                   showConfirmButton: false,
                   target: document.getElementById('appContainer'),})
        var data = await eel.create_wallet(pass1)()

        if (data[0]) {
            html = '<h3 class="mt-0">Please backup in non-digital form your seed phrase</h3>'+
                   '<hr /><h4>'+data[1]+'</h4><hr />'
            Swal.fire({
                icon: 'success',
                title: '24 SEED WORD PHRASE',
                html: html,
                showConfirmButton: true,
                confirmButtonText: 'Confirm',
                target: document.getElementById('appContainer'),
            }).then(function(){location.reload()});
        } else {
            $('.pre_wallet').attr('hidden', true)
            $('.on_wallet').removeAttr('hidden')
            Swal.fire({
                icon: 'warning',
                title: '24 SEED WORD PHRASE',
                html: data[1],
                showConfirmButton: true,
                confirmButtonText: 'Confirm',
                target: document.getElementById('appContainer'),
            })
        }
    }
}

async function walletBalance() {
    $('.wallet_refresh_btn').addClass('fa-spin')
    var balance = await eel.wallet_balance()()
    if (balance[0]) {
        total = balance[0].total.toFixed(4)
        height = balance[0].height.toLocaleString('en-US')
        locked = balance[0].locked.toFixed(4)
        immature = balance[0].immature.toFixed(4)
        wait_conf = balance[0].wait_conf.toFixed(4)
        spendable = balance[0].spendable.toFixed(4)
        usd_value = balance[0].usd_value
        wait_final = balance[0].wait_final.toFixed(4)
        lastWalletBalance = spendable

        $('.wallet_total').html(total)
        $('.wallet_height').html(height)
        $('.wallet_locked').html(locked)
        $('.wallet_wait_conf').html(wait_conf)
        $('.wallet_spendable').html(spendable)
        $('.wallet_usd_value').html(usd_value)
        $('.wallet_wait_final').html(wait_final)
    }
    $('.wallet_refresh_btn').removeClass('fa-spin')
}

async function walletData() {
    var data = await eel.wallet_data()()

    if (data.ext_ip) {
        $(".listenerIP").html(data.ext_ip);
        $(".listenerPort").text(data.port)
        if (data.open_port) {
            $(".listenerPortCheck").html("<span class='fs- indicator online' data-bs-toggle='tooltip' data-bs-placement='top' title='Port is open'></span>")
            $("#receive_port_feedback").attr('hidden', true)
        } else {
            $(".listenerPortCheck").html("<span class='fs-6 indicator error' data-bs-toggle='tooltip' data-bs-placement='top' title='Port is closed'></span>")
            $("#receive_port_feedback").removeAttr('hidden')

        }
    }

    if (data.local_node_synced[0]) {
        $("#walletNodeIcon").html('<span class="material-icons text-success align-middle">enhanced_encryption</span>')
        $("#walletNodeStatusToolTip").attr('title', 'Connected to local node')
    } else {
        $("#walletNodeIcon").html('<span class="material-icons text-success align-middle">no_encryption</span>')
        $("#walletNodeStatusToolTip").attr('title', 'Local node offline, will connect to outside nodes')
    }
    return data.local_node_synced
}

async function checkPendingFileTX() {
    var pending = await eel.pending_send_file_tx()()
    if (pending.slice(-1)[0]) {
        $('#wallet_pending_file_tx').removeAttr('hidden')
        $('#wallet_pending_file_tx_address').text(pending.slice(-1)[0].file)
        $('#wallet_pending_file_tx_btn').attr('title', pending.slice(-1)[0].amount + ' EPIC')
    } else {
        $('#wallet_pending_file_tx').attr('hidden')
    }
}

function changeTab(tab_) {
    $('#wallet_send_tabs button[data-bs-target="#'+tab_+'"]').tab('show')
}

function nextWalletStep1() {
    // -- method = true is HTTP/S method, false is File method
    var method = $('#send_method_input').is(':checked')
    var file_icon = '<span class="material-icons align-middle">description</span>'
    var http_icon = '<span class="material-icons align-middle">public</span>'
    console.log(method)
    if (method) {
        $('#file_ext').html('')
        $('#send_address_input').attr('placeholder', 'https://...')
        $('#address_title').html(http_icon + ' Recipient HTTP/S address')
        $('#sendAddressIcon').html('public')
    } else {
        $('#file_ext').html('.tx')
        $('#send_address_input').attr('placeholder', 'file_name')
        $('#address_title').html(file_icon + ' Transaction file name')
        $('#sendAddressIcon').html('description')
    }
    changeTab(tab_='send_address_screen')
}

async function nextWalletStep2() {
    var address = $('#send_address_input').val()
    var method = $('#send_method_input').is(':checked')
    var amount = $('#send_amount_input').val()
    var btn = $('#tx_confirm_btn')

    $('#address_confirm_btn').html(spinner)
    if (!method) {address = address + '.tx'}
    $('#sendAmount').html(amount)
    $('#sendAddress').html(address)

    changeTab(tab_='send_confirm_screen')

    btn.removeClass('btn-warning')
    btn.addClass('btn-success')
    btn.html('Confirm')
    btn.attr('data-bs-dismiss', '')
    btn.attr('onclick', 'walletSend()')
    $('#address_confirm_btn').html('Next')
}

async function walletSend() {
    var password = $('#send_password_input').val()
    var address = $('#send_address_input').val()
    var amount = $('#send_amount_input').val()
    var method = $('#send_method_input').is(':checked')
    var btn = $('#tx_confirm_btn')

    if (!method) {address = address + '.tx'}

    $('#send_password_input').val('')

    if (!address) {
        walletToast(icon='warning', title='Please provide recipient address')
    } else if (!amount) {
        walletToast(icon='warning', title='Please provide amount')
    } else {
        changeTab(tab_='send_confirm_screen')
        $('.container-animation').removeClass('hidden')
        btn.html(spinner)
        var response = await eel.send(address, amount, method, password)()

        if (response[1]) {
            if (response === 'Password is incorrect') {
                walletToast(icon='warning', 'Re-type password and try again')
                btn.addClass('btn-warning')
                btn.html('Try again')
                password = $('#send_password_input').val()
            }
            walletToast(icon='error', title=response[1])
            btn.addClass('btn-warning')
            btn.html('Try again')
        } else {
            walletToast(icon='success', title='Transaction sent successfully!')
            btn.removeClass('btn-warning')
            btn.addClass('btn-success')
            btn.html('Close')
            btn.attr('onclick', 'hideWalletTabs()')
            if (!method) {
                btn.html('SHOW TRANSACTION FILE')
                btn.attr('onclick', 'openWalletDir()')
            }
            walletBalance()
            walletTransactions()
        }
        $('.container-animation').addClass('hidden')
    }
}

async function showSeedPhrase() {
    const { value: password } = await Swal.fire({
        title: 'Enter your password',
        showCancelButton: true,
        input: 'password',
        inputLabel: 'Password',
        inputPlaceholder: 'Enter your password',
        inputAttributes: {
            maxlength: 10,
            autocapitalize: 'off',
            autocorrect: 'off'
        }
    })
    if (password) {
        Swal.fire({title: 'Processing...', html: '<h3>'+spinner+'</h3>'})
        var data = await eel.show_seed_phrase(password)()
        if (data[0]) {
            Swal.fire({title: '24-word Seed Phrase', html: data[1]})
        } else {
            Swal.fire({html: data[1]})
        }
    }
}

function walletToast(icon='', title='') {
    Swal.fire({
        toast: true,
        target: document.getElementById('walletBody'),
        icon: icon,
        title: title,
        position: 'center',
        showConfirmButton: false,
        timer: 3000,
    })
}

function showToast(icon='', title='', position='center', timer=3000) {
    Swal.fire({
        toast: true,
        icon: icon,
        title: title,
        position: position,
        showConfirmButton: false,
        timer: timer,

        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer)
          toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    })
}

async function rollbackCheck() {
    if (await eel.rollback_check()()) {
            changeStatus($('#serverStatus'), 'Downloading..')
            changeIcon($('#serverIcon'), 'sync')
            showToast(icon='info', title='Downloading Epic-Cash blockchain (may take up to 2 hours)... Please restart when finished')
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
        $('#serverHeight').html(data.tip.height)
        $('#serverPeers').html(data.connections)
        $('#serverSize').html(size)
    } else {
        $('#serverHeight').html(spaceHolder)
        $('#serverPeers').html(spaceHolder)
        $('#serverSize').html(spaceHolder)
    }
}
function sleep(ms) {return new Promise(resolve => setTimeout(resolve, ms));}

async function startListener() {await eel.start_listener()}
async function startServer() {await eel.start_server()}
async function startCPU() {await eel.start_cpu_miner()}
async function startGPU() {await eel.start_gpu_miner()}
async function stopListener() {eel.close_process('epic-wallet.exe')}
async function stopServer() {eel.close_process('epic.exe')}
async function stopCPU() {eel.close_process('epic-miner-cpu.exe')}
async function stopGPU() {eel.close_process('epic-miner-gpu.exe')}
async function openTOML(file) {await eel.open_toml_file(file)()}
async function openLogFile(file) {await eel.open_log_file(file)()}
async function runWalletTerminal() {await eel.run_terminal()}
async function showWalletApp() {await eel.show_wallet_app()}
async function isWallet() {await eel.is_wallet()}
async function openWalletDir() {await eel.open_wallet_dir()}
async function saveDB(table, data, toml) {await eel.db_save(table, data, toml)}

async function getDB(table, key, field) {
    var data = await eel.db_get(table, key)()
    if (data) {
        $('#'+field).val(data)
    }
}

async function generateNgrokAddress() {
    var btn = $('#ngrok_add')
    btn.html('GENERATING ADDRESS... '+ spinner)
    var data = await eel.run_ngrok()()
    if (data) {
        $('.local_address_section').attr('hidden', true)
        $('.ngrok_https_address').html(data)
        $('.ngrok_section').removeAttr('hidden')
        btn.html('<i class="fas fa-undo-alt"></i> SHOW LOCAL ADDRESS')
        btn.attr('onclick', 'showLocalAddress()')
    }
}

function showLocalAddress() {
    var btn = $('#ngrok_add')
        $('.ngrok_section').attr('hidden', true)
        $('.local_address_section').removeAttr('hidden')
        btn.html('GENERATE NGROK ADDRESS')
        btn.attr('onclick', 'generateNgrokAddress()')
}

async function walletCheck() {
    Swal.fire({
        icon: 'info',
        html: '<h3 class="mb-4">Checking against blockchain</h5>'+
              'This process may take couple of minutes, you can close this window.'+
              '<h3>'+spinner+'</h3>',
        confirmButtonText:'Confirm',
    })

    var check = await eel.check()()
    if (check[0]) {
        Swal.fire({
            icon: 'success',
            title: 'Checking Transaction and Balances',
            text: 'Wallet successfully checked and fixed',
            confirmButtonText:'Confirm',
        })
    } else {
       Swal.fire({
            icon: 'error',
            title: 'Checking Transaction and Balances',
            text: check[1],
            confirmButtonText:'Confirm',
        })
    }
}

async function walletCancelTX(id) {
    Swal.fire({html: '<h3>'+spinner+'</h3>'})
    var canceled = await eel.cancel_tx(id)()
    if (canceled[1]) {
        Swal.fire({
            icon: 'error',
            title: 'Transaction cancellation error',
            text: canceled[1],
            confirmButtonText:'Confirm',
        })
    } else {
        Swal.fire({
            icon: 'success',
            title: 'Transaction successfully canceled',
            confirmButtonText:'Confirm',
        })
        walletTransactions(max=5)
    }
}

function walletDetailedBalance() {
    var refresh = '<a href="#" onclick="walletDetailedBalance()" class="text-dark mx-3">'+
                  '<i style="font-size: 26px; width: 26px" class="fa fa-refresh wallet_refresh_btn"></i></a>'
    var available_txt = '<small class="text-muted">amount currently available for transacting</small>'
    var pending_txt = '<small class="text-muted">balance from transactions added to network, spendable after 10 confirmations</small>'
    var waiting_txt = '<small class="text-muted">balance from transactions not added to network yet, requires action from one of the transaction party</small>'
    var locked_txt = '<small class="text-muted">balance locked by a previous transaction you have made that is currently waiting </small>'
    var immature_txt = '<small class="text-muted">coinbase (mining) rewards in the wallet that have not yet matured and are unavailable for spending</small>'

    Swal.fire({
        title: 'Wallet Balance ' + refresh,
//        icon: 'info',
        html:
            '<table class="table table-borderless mt-2">'+
            '<tr><td class="text-start">AVAILABLE<br />'+available_txt+'</td>'+
            '<td class="fs-3 w-50 text-success text-end">'+spendable+'</td></tr>'+
            '<tr><td class="text-start">PENDING<br />'+pending_txt+'</td>'+
            '<td class="fs-3 w-50 text-info text-end">'+wait_conf+'</td></tr>'+
            '<tr><td class="text-start">WAITING<br />'+waiting_txt+'</td>'+
            '<td class="fs-3 w-50 text-warning text-end">'+wait_final+'</td></tr>'+
            '<tr><td class="text-start">LOCKED<br />'+locked_txt+'</td>'+
            '<td class="fs-3 w-50 text-danger text-end">'+locked+'</td></tr>'+
            '<tr><td class="text-start">IMMATURE<br />'+immature_txt+'</td>'+
            '<td class="fs-3 w-50 text-dark text-end">'+immature+'</td></tr>'+
            '</table>',
        showCloseButton: true,
        confirmButtonText:'Confirm',
    })
}

async function walletTransactions(max) {
    var table = $('#wallet_history_table tbody')
    var status = ''
    var amount = 0
    var tab_spin = '<tr class="tab-spin"><td colspan="3">'+spinner+'</td></tr>'
    table.find("tr").remove();
    table.append(tab_spin)
    var txs = await eel.transactions()()


    if (txs) {
        let newArray = txs.slice(0, max)
        var rowElements = newArray.map(function (tx) {
            var cancel = '<a href="#" onclick="walletCancelTX('+tx.id+')"><span class="material-icons text-danger align-middle mx-1">highlight_off</span></a>'

            // STATUS PARSER
            if (tx.status === 'completed') {
                status = '<span class="material-icons text-success">done_all</span>'
            } else if (tx.status === 'pending') {
                status = '<span class="material-icons text-info ml-1">done</span>' + cancel
            } else {
                status = '<span class="material-icons text-danger">block</span>'
            }

            // AMOUNT PARSER
            if (tx.amount < 0) {
                amount = '<span class="text-danger"><span class="material-icons mr-2 align-middle">call_made</span>'+tx.amount+'</span>'
            } else {
                amount = '<span class="text-success"><span class="material-icons mr-2 align-middle">call_received</span>'+tx.amount+'</span>'
            }

            // Create a row
            var $row = $('<tr></tr>');

            // Create the columns
            var $status = $('<td></td>').html(status);
            var $time = $('<td></td>').html(tx.created_date+' '+tx.created_time);
            var $amount = $('<td></td>').html(amount);

            // Add the columns to the row
            $row.append($status, $time, $amount);

            // Add to the newly-generated array
            return $row;
        });

        // Finally, put ALL of the rows into your table
        table.find("tr").remove();
        table.append(rowElements);
    } else {
        table.find("tr").remove();
        table.append('<tr class="fs-4 text-muted my-4"><td colspan="3">No transaction history</td></tr>')
    }
    $('.tab-spin').attr('hidden', true)
};

async function finalizeTX() {
    var btn = $('#finalize_btn')
    btn.html('Upload and finalize ' + spinner)
    var response = await eel.finalize_tx()()
    if (response[1]) {
        if (response[1] != 'nofile'){
            Swal.fire({
                icon: 'error',
                title: 'Finalization failed',
                text: response[1],
        })}
    } else {
            Swal.fire({
            icon: 'success',
            title: 'Finalization completed',
            text: 'Your transaction is finished!',
        })
    }
    btn.html('Upload and finalize')

}

async function createResponseTX() {
    var btn = $('#response_btn')
    btn.html('UPLOAD TRANSACTION FILE ' + spinner)
    var response = await eel.create_response()()

    if (response[1]) {
        if (response[1] != 'nofile'){
            Swal.fire({
                icon: 'error',
                title: 'Creating response failed',
                text: response[1],
            })}
    } else {
            Swal.fire({
            icon: 'success',
            title: 'Creating response successful!',
            text: 'Your transaction response file is created, please send it back to transaction creator.',
        })
    }
    btn.html('UPLOAD TRANSACTION FILE')
}

async function backupWalletData() {
    $('#wallet_options_backup_btn_spinner').html(spinner)
    var data = await eel.backup_wallet_data()()
    if (data) {
        Swal.fire({
            icon: 'success',
            title: 'Your backup is created successfully!',
            html: '<p>PATH TO YOUR WALLET BACKUP</p>' +
                  '<p>'+data[0]+'/'+data[1]+'</p>'
    })}
    $('#wallet_options_backup_btn_spinner').html('')
}

async function importFromFiles() {
    $('#wallet_options_import_btn_spinner').html(spinner)
    var data = await eel.import_data()()
    if (data) {
        Swal.fire({
            icon: 'success',
            title: 'Your wallet was imported successfully!',
        })
        walletData()
    }
    $('#wallet_options_import_btn_spinner').html('')
}


// -------------------- OTHER FUNCTIONS -------------------- \\
function hideWalletTabs() {
    var active = $(".tab-wallet.active").attr("id")
    $('#'+active).removeClass('active show')
    $('.link-wallet.active').removeClass('active show')
}

function showSendWalletTab() {
    var send_tab = $("#wallet_send_tab")
    hideWalletTabs()
    send_tab.addClass('active show')
    $('.link-wallet a[href="wallet_send_tab"').addClass('active show')
    changeTab(tab_='send_finalize_screen')
    $('#wallet_pending_file_tx').attr('hidden', true)
}


function copyWalletAddress() {
    var $temp = $("<input>");
    $("body").append($temp);
    var ip = $(".listenerIP").eq(0).text()
    var port = $(".listenerPort").eq(0).text()
    $temp.val(ip+':'+port).select();
    document.execCommand("copy");
    $temp.remove();
    $('#liveToast').toast('show');
}

function copyNgrokAddress() {
    var $temp = $("<input>");
    $(".ngrok_section").append($temp);
    var ip = $(".ngrok_https_address").text()
    $temp.val(ip).select();
    document.execCommand("copy");
    $temp.remove();
    $('#liveToast').toast('show');
}

function settingsToast() {
    Swal.fire({
        toast: true,
        icon: 'success',
        title: 'Setting saved',
        animation: false,
        position: 'top-right',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer)
          toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
      })
}


