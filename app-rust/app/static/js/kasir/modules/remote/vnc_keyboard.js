/**
 * VNC Client - Virtual Onscreen Keyboard & Shortcut Presets
 */
if (typeof VNCSession !== 'undefined') {
    Object.assign(VNCSession.prototype, {
    getLettersRows() {
        return [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
            [
                { label: '⇧', action: 'shift', style: 'bg-[#222] border-neutral-700 min-w-[36px]' },
                'z', 'x', 'c', 'v', 'b', 'n', 'm',
                { label: '⌫', action: 'backspace', style: 'bg-[#222] border-neutral-700 min-w-[36px]' }
            ],
            [
                { label: 'Esc', action: 'esc', style: 'bg-[#222] border-neutral-700' },
                { label: 'Tab', action: 'tab', style: 'bg-[#222] border-neutral-700' },
                { label: 'Spasi', action: 'space', style: 'flex-[2.5]' },
                { label: 'Enter', action: 'enter', style: 'bg-[#222] border-neutral-700' }
            ]
        ];
    },

    getSymbolsRows() {
        return [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
            ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
            ['_', '\\', '|', '~', '<', '>', ',', '.', '?', '!'],
            [
                { label: 'Esc', action: 'esc', style: 'bg-[#222] border-neutral-700' },
                { label: '⌫', action: 'backspace', style: 'bg-[#222] border-neutral-700' },
                { label: 'Spasi', action: 'space', style: 'flex-[2.5]' },
                { label: 'Enter', action: 'enter', style: 'bg-[#222] border-neutral-700' }
            ]
        ];
    },

    getFunctionRows() {
        return [
            [
                { label: 'F1', keysym: 0xffbe },
                { label: 'F2', keysym: 0xffbf },
                { label: 'F3', keysym: 0xffc0 },
                { label: 'F4', keysym: 0xffc1 },
                { label: 'F5', keysym: 0xffc2 },
                { label: 'F6', keysym: 0xffc3 }
            ],
            [
                { label: 'F7', keysym: 0xffc4 },
                { label: 'F8', keysym: 0xffc5 },
                { label: 'F9', keysym: 0xffc6 },
                { label: 'F10', keysym: 0xffc7 },
                { label: 'F11', keysym: 0xffc8 },
                { label: 'F12', keysym: 0xffc9 }
            ],
            [
                { label: 'Esc', action: 'esc', style: 'bg-[#222] border-neutral-700' },
                { label: 'Tab', action: 'tab', style: 'bg-[#222] border-neutral-700' },
                { label: 'Del', keysym: 0xffff, style: 'bg-[#222] border-neutral-700 text-red-400 font-bold' },
                { label: 'Home', keysym: 0xff50, style: 'bg-[#222] border-neutral-700' },
                { label: 'End', keysym: 0xff57, style: 'bg-[#222] border-neutral-700' },
                { label: 'PgUp', keysym: 0xff55, style: 'bg-[#222] border-neutral-700' },
                { label: 'PgDn', keysym: 0xff56, style: 'bg-[#222] border-neutral-700' }
            ],
            [
                { label: 'PrtSc', keysym: 0xff61, style: 'bg-[#222] border-neutral-700 text-[10px]' },
                { label: 'Insert', keysym: 0xff63, style: 'bg-[#222] border-neutral-700 text-[10px]' },
                { label: 'Spasi', action: 'space', style: 'flex-[2.5]' },
                { label: 'Enter', action: 'enter', style: 'bg-[#222] border-neutral-700' }
            ]
        ];
    },

    toggleVirtualKeyboard(kbId, prefix = '') {
        const kb = document.getElementById(kbId);
        if (!kb) return;
        if (kb.classList.contains('hidden')) {
            kb.classList.remove('hidden');
            this.switchKeyboardLayout('letters', prefix);
        } else {
            kb.classList.add('hidden');
        }
    },

    switchKeyboardLayout(layout, prefix = '') {
        this.keyboardLayout = layout;
        const tabLetters = document.getElementById(`${prefix}kb-tab-letters`);
        const tabSymbols = document.getElementById(`${prefix}kb-tab-symbols`);
        const tabFunction = document.getElementById(`${prefix}kb-tab-function`);

        const activeClass = 'px-3 py-1 text-[10px] font-bold rounded bg-neutral-200 text-black transition-colors';
        const inactiveClass = 'px-3 py-1 text-[10px] font-bold rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:bg-[#222] transition-colors';

        if (tabLetters) tabLetters.className = layout === 'letters' ? activeClass : inactiveClass;
        if (tabSymbols) tabSymbols.className = layout === 'symbols' ? activeClass : inactiveClass;
        if (tabFunction) tabFunction.className = layout === 'function' ? activeClass : inactiveClass;

        this.renderKeyboardKeys(`${prefix}kb-keys-grid`, prefix);
    },

    toggleKeyboardShift(gridId, prefix = '') {
        this.shiftActive = !this.shiftActive;
        this.renderKeyboardKeys(gridId, prefix);
    },

    renderKeyboardKeys(gridId, prefix = '') {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.innerHTML = '';

        let rows;
        if (this.keyboardLayout === 'letters') rows = this.getLettersRows();
        else if (this.keyboardLayout === 'symbols') rows = this.getSymbolsRows();
        else if (this.keyboardLayout === 'function') rows = this.getFunctionRows();
        else rows = this.getLettersRows();

        rows.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'flex gap-1 justify-center w-full';

            row.forEach(key => {
                const btn = document.createElement('button');
                let label;
                let btnClass = 'py-2 px-1 rounded text-neutral-200 bg-[#141414] border border-[#222] transition-colors text-xs text-center flex-1 select-none touch-manipulation font-semibold active:scale-[0.98]';

                if (typeof key === 'string') {
                    const displayChar = this.shiftActive && this.keyboardLayout === 'letters' ? key.toUpperCase() : key;
                    label = displayChar;
                    this.bindVirtualKeyEvents(btn, key, gridId, prefix);
                } else {
                    label = key.label;
                    if (key.style) btnClass += ' ' + key.style;
                    this.bindVirtualKeyEvents(btn, key, gridId, prefix);
                }

                btn.className = btnClass;
                btn.textContent = label;
                rowDiv.appendChild(btn);
            });
            grid.appendChild(rowDiv);
        });
    },

    bindVirtualKeyEvents(btn, charOrKeyInfo, gridId, prefix = '') {
        let keysym;
        let isChar = false;
        let charVal = '';

        if (typeof charOrKeyInfo === 'string') {
            isChar = true;
            charVal = this.shiftActive && this.keyboardLayout === 'letters' ? charOrKeyInfo.toUpperCase() : charOrKeyInfo;
            keysym = charVal.charCodeAt(0);
        } else {
            if (charOrKeyInfo.keysym) {
                keysym = charOrKeyInfo.keysym;
            } else if (charOrKeyInfo.action === 'shift') {
                btn.onclick = (e) => {
                    e.preventDefault();
                    this.toggleKeyboardShift(gridId, prefix);
                };
                btn.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
                return;
            } else if (charOrKeyInfo.action === 'backspace') keysym = 0xff08;
            else if (charOrKeyInfo.action === 'tab') keysym = 0xff09;
            else if (charOrKeyInfo.action === 'space') keysym = 0x0020;
            else if (charOrKeyInfo.action === 'enter') keysym = 0xff0d;
            else if (charOrKeyInfo.action === 'esc') keysym = 0xff1b;
        }

        const handlePress = (e) => {
            e.preventDefault();
            btn.classList.add('bg-neutral-200', 'text-black', 'border-white');
            btn.classList.remove('bg-[#141414]', 'text-neutral-200', 'border-[#222]', 'bg-[#222]');
            this.sendKey(keysym, null, true);
        };

        const handleRelease = (e) => {
            e.preventDefault();
            btn.classList.remove('bg-neutral-200', 'text-black', 'border-white');
            if (typeof charOrKeyInfo !== 'string' && charOrKeyInfo.style && charOrKeyInfo.style.includes('bg-[#222]')) {
                btn.classList.add('bg-[#222]', 'text-neutral-200', 'border-[#222]');
            } else {
                btn.classList.add('bg-[#141414]', 'text-neutral-200', 'border-[#222]');
            }
            this.sendKey(keysym, null, false);

            if (isChar && this.shiftActive && this.keyboardLayout === 'letters') {
                this.shiftActive = false;
                this.renderKeyboardKeys(gridId, prefix);
            }
        };

        btn.addEventListener('pointerdown', handlePress);
        btn.addEventListener('pointerup', handleRelease);
        btn.addEventListener('pointerleave', handleRelease);
        btn.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    },

    sendShortcutPreset(preset) {
        if (preset === 'Win+R') {
            this.sendKey(0xffeb, null, true);
            this.sendKey('r'.charCodeAt(0), null, true);
            this.sendKey('r'.charCodeAt(0), null, false);
            this.sendKey(0xffeb, null, false);
        } else if (preset === 'Win+D') {
            this.sendKey(0xffeb, null, true);
            this.sendKey('d'.charCodeAt(0), null, true);
            this.sendKey('d'.charCodeAt(0), null, false);
            this.sendKey(0xffeb, null, false);
        } else if (preset === 'Alt+Tab') {
            this.sendKey(0xffe9, null, true);
            this.sendKey(0xff09, null, true);
            this.sendKey(0xff09, null, false);
            this.sendKey(0xffe9, null, false);
        } else if (preset === 'Alt+F4') {
            this.sendKey(0xffe9, null, true);
            this.sendKey(0xffbe, null, true);
            this.sendKey(0xffbe, null, false);
            this.sendKey(0xffe9, null, false);
        }
    },

    sendSpecialKey(keysym) {
        this.sendKey(keysym, null, true);
        this.sendKey(keysym, null, false);
    },

    });
}
