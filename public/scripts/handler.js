$(function() {
    var socket = io();
    // to make sure client socket already has been registered when page was opened
    var registered = false;

    // On 'connect' event need to send back 'register' event one time
    socket.on('connect', () => {
        console.log('connected');
        var data = {};
        var pomString = window.location.pathname.split('/')[2];
        pomString = pomString.replace(/%EF%BB%BF/g, '');
        data.webSessionId = pomString;
        if (!registered && data.webSessionId) {
            console.log('trying to register session', data);
            socket.emit('register', data);
        } else if (registered) {
            console.log('already registered');
        } else if (!data.webSessionId) {
            console.log('web session is not defined')
        }
    });

    // On 'registered'
    socket.on('registered', () => {
        registered = true;
        console.log('session registered');
    });

    // On 'page' event need to render page content
    socket.on('page', function(data) {
        console.log('page message received:', data);
        $('#inter-area').detach();
        $('#jumbo-area').append($('<div id="inter-area">'));

        var contentType = data['contentType'];
        console.log(contentType, 'found');

        if (contentType === 'question') {
            // render question
            var question = data['question'];
            $('#inter-area').append($('<div id="text-area">'));
            $('#text-area').append(question['questionText']);
            $('#inter-area').append($('<form id="input-area">'));
            $('form#input-area').append($('<div id="query-area">'));

            if (question['questionType'] === 'choice') {
                // render multiple choice question
                question['options'].forEach(function (option) {
                    var optionId = 'option-' + option['id'].toString();
                    console.log(optionId);
                    $('#query-area').append($('<div class="option-area" id="' + optionId + '">'));

                    console.log('<input type="radio" name ="one-of" id="radio-' + optionId + '" value="' + option['value'] + '">');
                    $('#' + optionId).append($('<input type="radio" name="one-of" id="radio-' + optionId + '" optID="' + option['id'].toString() +'" value="' + option['value'] + '">'));
                    $('#' + optionId).append($('<label for="radio-' + optionId + '">'));
                    $('#' + optionId + ' label').append(option['value']);
                });
                // render forward button
                $('form#input-area').append($('<div id="send-area">'));
                $('#send-area').append($('<button disabled>'));
                $('button').append('Далее');

                // make button enabled upon radio select
                $('input').click(() => {
                  console.log('going to make button enabled');
                  $('button').removeAttr('disabled');
                });

                // assign action on submit
                $('form#input-area').submit(() => {
                    var response = {
                        'questionId': question['questionID'],
                        'responseValue': $('input[name="one-of"]:checked').attr('optID')
                    }
                    console.log('emitting response:', response);
                    socket.emit('select', response);
                    return false;
                });
            } else if (question['questionType'] === 'email') {
                // render email field
                $('#query-area').append($('<input type="text" placeholder="email" name="email">'));
                // render forward button
                $('form#input-area').append($('<div id="send-area">'));
                $('#send-area').append($('<button>'));
                $('button').append('Далее');
                // assign action on submit
                $('form#input-area').submit(() => {
                    var $email = $('form input[name="email"]');
                    var re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,4}/igm;
                    // email validation
                    if ($email.val() == '' || !re.test($email.val()))
                    {
                        if (!$('#event-area').length) {
                            $('body').append('<div id="event-area" style="display: none;">');
                            $('#event-area').append('Неправильный формат email');
                            $('#event-area').fadeIn(1500, () => {
                                $('#event-area').fadeOut(3500, () => {
                                    $('#event-area').detach();
                                });
                            });
                        }
                    } else {
                        var response = {
                            'questionId': question['questionID'],
                            'responseValue': $('input[name="email"]').val()
                        }
                        console.log('emitting response:', response);
                        socket.emit('select', response);
                    }
                    return false;
                });
            } else {
                // render something goes wrong
                $('#inter-area').detach();
                $('#jumbo-area').append($('<div id="inter-area">'));
                $('#inter-area').append($('<div id="wrong-area">'));
                $('#wrong-area').append('Упс.. Что-то пошло не так :(');
            }
        } else if (contentType === 'announcement') {
            // render announcement
            $('#inter-area').detach();
            $('#jumbo-area').append($('<div id="inter-area">'));
            $('#inter-area').append($('<div id="text-area">'));
            $('#text-area').append(data['announcement']['text']);
        }
    });

});
