/*******************************************************************************
popup() argument options:
- message {string}:
    The message to be shown.  If used, `inputs` will be ignored.
- inputs {Object}:
    The inputs to be shown.  The options are as follows:
    - message {string}:
        The message to show above each input.
    - type {string}:
        Optional.  Defaults to "TEXT".  Is case-insensitive.  Possible values
        are "TEXT", "TEXTAREA", "SELECT" and "MULTI-SELECT".  For textareas you
        can specify the amount of rows by adding a colon followed by the number
        of rows (eg. "TEXTAREA:3").
    - options {Array<string|{text:?string,value:*,selected:boolean=}>}:
        Must be present if `type` is "SELECT" or "MULTI-SELECT".  Specifies the
        options in the select box.
    - value {string}:
        Optional.  Defaults to the empty string.  If specified this is the
        value that will appear in the text or textarea to begin with.
    - validate {function(string, number, number, function(boolean|string)): string}:
        Optional.  If specified, this will be used to validate the input once
        the focus is lost.  The 1st argument passed will be the input value.
        The 2nd argument passed will be the index of the input.  The 3rd
        argument passed will be the index of the button (`undefined` means
        validate was called either by a timeout or a change in input focus).
        The 4th argument passed will be a function which will accept either a
        boolean indicating whether or not the input is valid or a string
        indicating why the input is invalid (empty string means input is valid).
        The value returned from the validate function will replace the value
        found in the input.
    - required {boolean|RegExp}:
        Optional.  Defaults to `false` which means this input is not required.
        If `true`, the field may not be left blank.  If a regular expression is
        given it will be used to validate the input.
    - trim {boolean|RegExp}:
        Optional.  Defaults to `false`.  If `true` whitespace characters will be
        removed from the beginning and end of the text or textarea.  Specifying
        a regular expression will cause the substrings that match that regular
        expression to be removed from the text or textarea.
    - error {string}:
        Optional.  Defaults to `popup.ERROR`.  The error message shown if the
        input's validate() function indicates that the input is invalid but
        doesn't give an error message.
- title {string}:
    Optional.  Title to be shown above the inputs or message.
- buttons {Array<string>}:
    Optional.  Defaults to the value of `popup.BUTTONS`.  The buttons that
    will appear at the bottom of the popup.
- index {number}:
    Optional.  Defaults to the value of `popup.INDEX`.  The index of the
    default button.
- cancel {number}:
    Optional.  If specified, this will be the index of the button that will
    allow for the popup to close even if one or more of the inputs is invalid.
- onDone {function(index, hasTimedOut [, inputValues])}:
    Optional.  Called once the popup closes.  The 1st argument passed will be
    the index of the chosen button.  The 2nd argument passed will  indicate if
    the popup timed out.  If inputs were specified those values will be passed
    back in an array as the 3rd argument.
- parent {DOMElement}:
    Optional.  The parent element in which the popup and corresponding
    overlay should be placed.
- zIndex {number}:
    Optional.  Defaults to the value of `popup.Z_INDEX`.  The z-index for
    the overlay and the popup.
- onOverlayClick {function(Prompt)}:
    Optional.  This function will be called whenever the overlay is clicked.
- timeout {number}:
    Optional.  If specified this will be used as the maximum amount of
    milliseconds to show the popup before it is automatically closed.  If the
    timeout is reached the `index` will be -1.
- unindex {boolean}:
    Optional.  Defaults to `false`.  If `true`, any time that an input has an
    `id`, the resulting value will be stored in the property of that name and
    not in the index.
*******************************************************************************/
(function(__global, RGX_TRIM_WS, getElemByClassName, typeOf, hasOwnProp, removeElem, undefined) {
  var document = __global.document,
      body = document.body,
      CLS = 'popup_js';

  function popup(options) {
    var newOptions = extend({ done: false }, options),
        overlay = newOptions.$overlay = createOverlay(newOptions),
        container = newOptions.$container = createContainer(newOptions),
        timeout = options.timeout;
    if (timeout) {
      setTimeout(function() {
        callDoneAndTerminate(undefined, true, newOptions);
      }, timeout);
    }
    return newOptions._ = extend({
      close: function(index) {
        callDoneAndTerminate(index, undefined, newOptions);
      },
      overlay: overlay,
      element: container
    }, options);
  }

  function createOverlay(options) {
    var overlay = addToDoc(createElem('div', { className: CLS + ' overlay' }, {
      zIndex: options.zIndex || popup.Z_INDEX,
      background: options.overlayBackground || popup.OVERLAY_BACKGROUND
    }), options);
    return overlay;
  }

  function createContainer(options) {
    var container = addToDoc(createElem('div', { className: CLS + ' container' }, {
      zIndex: options.zIndex || popup.Z_INDEX
    }), options);
    var title = options.title;
    var buttons = options.buttons;
    var message = options.message;
    var inputs = options.inputs;
    var inputElems = options.$inputs = [];
    var inputWraps = options.$wraps = [];
    buttons = buttons && buttons[0] ? buttons : popup.BUTTONS;
    container.innerHTML
      = '<div class="dialog_box">'
        + (title ? '<div class="title"></div>' : '')
        + '<div class="content"></div>'
        + '<div class="buttons"></div>'
      + '</div>';

    if (title) {
      setElemText(getElemByClassName(container, 'title'), title);
    }

    var buttonsElem = getElemByClassName(container, 'buttons');
    forEach(buttons, function(button, i) {
      appendChild(buttonsElem, setElemText(createElem('button', { onclick: function() {
        callDoneAndTerminate(i, false, options);
      } }), button));
    });

    var contentElem = getElemByClassName(container, 'content');
    contentElem.style.maxHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0) - container.offsetHeight - 50;
    if (message) {
      setElemText(contentElem, message);
    }
    else if (inputs) {
      forEach(inputs, function(input, inputIndex) {
        var id = uid('input'),
            inputWrap = createElem('div', { className: 'input' }),
            inputType = input.type,
            strInputValue = toSimpleString(input.value),
            inputOptions = input.options,
            typeMatch = /^(?:(TEXT)|(TEXTAREA)(?::([1-9]\d*))?|((MULTI-)?SELECT)(?::([1-9]\d*))?)$/i.exec(inputType || 'TEXT') || [],
            inputElem
              = typeMatch[1]
                ? createElem('input', { type: 'text', value: strInputValue })
                : typeMatch[2]
                  ? createElem('textarea', { rows: typeMatch[3] || 3, value: strInputValue })
                  : typeMatch[4]
                    ? createElem('select', { size: typeMatch[6] || 1, multiple: typeMatch[5] || "" })
                    : undefined;
        if (!inputElem) {
          throw new Error('"' + inputType + '" is an invalid popup input type.');
        }
        if (typeMatch[4]) {
          if (!inputOptions) {
            throw new Error('Options must be given for popup inputs of type "' + inputType + '".')
          }
          forEach(inputOptions, function(option) {
            appendChild(
              inputElem,
              setElemText(
                createElem('option', { value: option.value, selected: option.selected || false }),
                hasOwnProp(option, 'text') ? option.text : option.value
              )
            );
          });
        }
        inputWraps.push(inputWrap);
        appendChild(
          inputWrap,
          prependChild(
            setElemText(createElem('label', { className: 'message', htmlFor: id }), input.message),
            setElemText(createElem('a', { className: 'error-indicator', href: 'javascript://', tabIndex: -1 }), '!')
          )
        );
        inputElems.push(extend(inputElem, {
          className: 'input',
          id: id,
          onblur: function() {
            callValidate(options, undefined, inputIndex);
          }
        }));
        appendChild(inputWrap, inputElem);
        appendChild(contentElem, inputWrap);
      });
    }

    extend(container.style, {
      marginTop: -container.offsetHeight / 2 + 'px',
      marginLeft: -container.offsetWidth / 2 + 'px'
    });

    return container;
  }

  function forEach(array, callback) {
    for (var i = 0, l = array.length; i < l; i++) {
      callback(array[i], i);
    }
  }

  function appendChild(parentNode, childNode) {
    parentNode.appendChild(childNode);
    return parentNode;
  }

  function prependChild(parentNode, childNode) {
    parentNode.insertBefore(childNode, parentNode.childNodes[0]);
    return parentNode;
  }

  function createElem(nodeName, opt_props, opt_styles) {
    var elem = document.createElement(nodeName);
    if (opt_props) {
      extend(elem, opt_props);
    }
    if (opt_styles) {
      extend(elem.style, opt_styles);
    }
    return elem;
  }

  function setElemText(elem, text) {
    elem.textContent = elem.innerText = text;
    return elem;
  }

  function getInputValues(options) {
    var val, id, values = {}, inputs = options.inputs;
    forEach(options.$inputs, function(inputElem, i) {
      val = inputElem.value;
      if (!options.unindex) {
        values[i] = val;
      }
      if (id = inputs[i].id) {
        values[id] = val;
      }
    });
    return values;
  }

  function callValidate(options, opt_buttonIndex, opt_inputIndex) {
    var invalid = false,
        inputs = options.inputs,
        inputElems = options.$inputs,
        inputWraps = options.$wraps,
        cancel = hasOwnProp(options, 'cancel') ? options.cancel : NaN;

    function iter(inputWrap, i) {
      var input = inputs[i],
          inputElem = inputElems[i],
          required = input.required,
          realValidate = input.validate,
          validate = required
            ? function(value, inputIndex, buttonIndex, setError) {
                setError(buttonIndex !== cancel && ((required === true && !value) || (typeOf(required) == 'RegExp' && !required.test(value))));
                return realValidate ? realValidate.apply(this, arguments) : value;
              }
            : realValidate,
          trim = input.trim,
          value = inputElem.value,
          errMsg,
          errorFound;

      // Trim the value if necessary.
      value = typeOf(trim = trim === true ? RGX_TRIM_WS : trim) == 'RegExp'
        ? value.replace(trim, '')
        : value;

      // Validate the value if possible.
      if (validate) {
        inputElem.value = toSimpleString(validate.call(options._, value, i, opt_buttonIndex, function(error) {
          if (errorFound = !!error) {
            errMsg = error === true ? input.error || popup.ERROR : error;
          }
        }));
        if (errorFound) {
          invalid = errorFound;
          extend(getElemByClassName(inputWrap, 'error-indicator'), {
            onclick: function() { alert(errMsg); },
            title: errMsg
          });
        }
        (errorFound ? addClass : removeClass)(inputWrap, 'error');
      }
    }

    if (opt_inputIndex != undefined) {
      iter(inputWraps[opt_inputIndex], opt_inputIndex);
    }
    else {
      forEach(inputWraps, iter);
    }
    return !invalid;
  }

  function callDoneAndTerminate(index, hasTimedOut, options) {
    if (!options.done) {
      options.done = true;
      var args,
          inputs = options.inputs,
          valid = inputs ? callValidate(options, index) : 1,
          onDone = options.onDone;
      // If it has timed out or if it has been closed by user code or if it was
      // finished without errors...
      if (hasTimedOut != false || valid) {
        removeElem(options.$overlay);
        removeElem(options.$container);
      }
      else {
        options.done = false;
      }
      // If it was finished without errors or it was closed by code and an onDone
      // event handler was defined...
      if ((valid || hasTimedOut == undefined) && onDone) {
        var args = [index, hasTimedOut];
        if (!options.message && options.inputs) {
          args.push(getInputValues(options));
        }
        onDone.apply(options._, args);
      }
    }
  }

  function addClass(elem, className) {
    removeClass(elem, className);
    elem.className += ' ' + className;
  }

  function removeClass(elem, className) {
    elem.className = (' ' + elem.className + ' ').split(' ' + className + ' ').join(' ');
  }

  function addToDoc(elem, options) {
    appendChild(options.parent || body, elem);
    return elem;
  }

  function extend(objToExtend, props) {
    for (var k in props) {
      if (hasOwnProp(props, k)) {
        objToExtend[k] = props[k];
      }
    }
    return objToExtend;
  }

  function toSimpleString(value) {
    return [value] + '';
  }

  function uid(prefix) {
    return prefix + ('' + Math.random()).replace('.', '');
  }

  popup.BUTTONS = ['OK'];
  popup.INDEX = 0;
  popup.Z_INDEX = 2147483647;  // 2^31 - 1
  popup.OVERLAY_BACKGROUND = 'rgba(0,0,0,0.8)';
  popup.ERROR = 'Invalid input entered.';

  var assignedName, prevValue, prevValueExisted;
  (popup.reassign = function(opt_globalName) {
    if (assignedName) {
      if (prevValueExisted) {
        __global[assignedName] = prevValue;
        prevValue = undefined;
      }
      else {
        delete __global[assignedName];
      }
    }
    if (prevValueExisted = assignedName = opt_globalName) {
      if (prevValueExisted = hasOwnProp(__global, assignedName)) {
        prevValue = __global[assignedName];
      }
      __global[assignedName] = popup;
    }
    return popup;
  })('popup');

  popup.getPrevious = function() {
    return prevValue;
  };

  // Add default CSS styles for popups:
  var styleElem = createElem('style', { type: 'text/css' });
  var cssCode =
    (''
      + '&.overlay{'
        + 'top:0;'
        + 'left:0;'
        + 'right:0;'
        + 'bottom:0;'
      + '}'
      + '&.container{'
        + 'font-family:Verdana,Geneva,sans-serif;'
        + 'top:50%;'
        + 'left:50%;'
        + 'padding:0.375em;'
        + 'width:auto;'
      + '}'
      + '& .content{'
        + 'padding:0.375em;'
        + 'width:auto;'
        + 'overflow:auto;'
        + 'display:block;'
      + '}'
      + '&{'
        + 'position:fixed;'
      + '}'
      + '& .title{'
        + 'background:#8BF;'
        + 'border:1px solid #08F;'
        + 'color:#FFF;'
        + 'border-radius:0.5em 0.5em 0.25em 0.25em;'
        + 'padding:0.1em 0.25em;'
        + 'text-shadow:0 0 1px #000,0 0 3px #000;'
        + 'margin:2px;'
        + 'display:block;'
      + '}'
      + '& .buttons{'
        + 'border-top:1px solid #EEE;'
        + 'text-align:center;'
        + 'padding:0.375em;'
      + '}'
      + '& .dialog_box{'
        + 'background:#FFF;'
        + 'border-radius:0.5em;'
        + 'box-shadow:0 0 2px 1px #000;'
        + 'width:auto;'
        + 'min-width:400px;'
        + 'padding:1px;'
      + '}'
      + '& .input .error-indicator{'
        + 'display:none;'
      + '}'
      + '& .input.error .error-indicator{'
        + 'display:inline-block;'
        + 'color:#FFF;'
        + 'background:#F00;'
        + 'height:1em;'
        + 'width:1em;'
        + 'text-align:center;'
        + 'margin-right:0.25em;'
        + 'border-radius:0.3em;'
        + 'font-size:0.8em;'
        + 'padding:0 0.1em 0.2em;'
        + 'text-decoration:none;'
      + '}'
      + '& .input.error .error-indicator:hover{'
        + 'background:#800;'
      + '}'
      + '& .input .message{'
        + 'display:block;'
      + '}'
      + '& .input .input{'
        + 'border:1px solid #DDD;'
        + 'padding:1px;'
        + 'width:100%;'
        + 'box-sizing:border-box;'
      + '}'
      + '& .input.error .input{'
        + 'background:#FCC;'
        + 'border:1px solid #F00;'
        + 'padding:1px;'
        + 'width:100%;'
      + '}'
    ).replace(/&/g, '.' + CLS);
  var styleSheet = styleElem.styleSheet;
  if (styleSheet && !styleElem.sheet) {
    styleSheet.cssText = cssCode;
  }
  else {
    appendChild(styleElem, document.createTextNode(cssCode));
  }
  prependChild(document.getElementsByTagName('head')[0] || document.body, styleElem);
})(
  'undefined' == typeof window ? this : window,
  /^[\s\xA0]+|[\s\xA0]+$/g,
  function (ancestorElem, className) { return ancestorElem.getElementsByClassName(className)[0]; },
  function (obj) { return ({}).toString.call(obj).slice(8, -1); },
  function (owner, propName) { return this.hasOwnProperty.call(owner, propName); },
  function (elem) { elem.parentNode.removeChild(elem); }
);