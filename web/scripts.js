async function getFile() {
var file_path = await eel.upload_file()();
var button = $('#upload_file')
	if (file_path) {
		console.log(file_path);
		await eel.edit_server_toml(file_path)()
		button.removeClass("btn-warning")
		button.addClass("btn-success")
		button.text("File successfully updated!")
	} else {
		button.addClass("btn-warning")
	    button.text("Wrong file, try again")
	}
}