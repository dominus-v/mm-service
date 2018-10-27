$(function() {
    var socket = io();

    $('form').submit(function() {
        let cmd = {
            'sessionId': $('#mm-sessionId').val(),
            'command': $('#mm-command').val(),
            'msg': $('#mm-message').val()
        }
        socket.emit(cmd.command, cmd);
        //$('#mm-command').val('');
        $('#mm-message').val('');
        return false;
    });
});