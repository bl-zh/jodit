import Jodit from "../Jodit"
import Component from "./Component"
import {dom, each, $$, extend, camelCase} from "./Helpers"
import * as consts from "../constants";
import Dom from "./Dom";

export type ControlType = {
    controlName?: string;
    name?: string;
    mode?: number;
    list?: {[key: string]: string} | string[];
    command?: string;
    tagRegExp?: RegExp;
    tags?: string[];
    options?: any;
    css?: any;
    iconURL?: string;
    tooltip?: string;
    exec?: (editor: Jodit, current: Node|false, control: ControlType, originalEvent: Event,  btn: HTMLLIElement) => void;
    args?: any[];
    cols?: number;
    template?: (editor: Jodit, key: string, value: string) => string;
    popup?:(editor: Jodit, current: Node|false, control: ControlType, close: Function) => HTMLElement;
}

type ButtonType = {
    btn: HTMLLIElement,
    control: ControlType,
    name: string,
}


export default class Toolbar extends Component{
    static icons = {};
    container: HTMLDivElement;
    popup: HTMLDivElement;
    list: HTMLDivElement;


    __popapOpened = false;
    __listOpened = false;

    /**
     *
     * @param {Jodit} parent
     *
     */
    constructor(parent: Jodit) {
        super(parent);
        this.container = <HTMLDivElement>dom('<div class="jodit_toolbar"/>');
        this.popup = <HTMLDivElement>dom('<div class="jodit_toolbar_popup"/>');
        this.list = <HTMLDivElement>dom('<ul class="jodit_dropdownlist"/>');

        this.initEvents();
    }

    /**
     * Return SVG icon
     *
     * @param {string} name icon
     * @param {string|boolean} [defaultValue='<span></span>']
     * @return {string}
     */
    static getIcon(name, defaultValue:string|false = '<span></span>') {
        return Toolbar.icons[name] !== undefined ? Toolbar.icons[name] : defaultValue;
    }

    /**
     *
     * @param {HTMLLIElement|HTMLAnchorElement} btn
     * @param {HTMLElement} content
     * @param {boolean} [rightAlign=false] Open popup on right side
     */
    openPopup(btn: HTMLLIElement|HTMLAnchorElement, content: HTMLElement, rightAlign: boolean = false) {
        // todo replace na position
        this.closeAll();
        btn.classList.add('jodit_popup_open');
        btn.appendChild(this.popup);
        this.__popapOpened = true;
        this.popup.innerHTML = '';
        this.popup.appendChild(content);
        this.popup.style.display = 'block';
        this.popup.classList.toggle('jodit_right', rightAlign);
    }

    /**
     *
     */
    openList(btn: HTMLLIElement) {
        btn.classList.add('jodit_dropdown_open');
        this.closeAll();
        this.__listOpened = true;
        this.list.style.display = 'block';
    }

    /**
     *
     */
    closeAll = () => {
        this.list.innerHTML = '';
        this.popup.innerHTML = '';
        this.popup.style.display = 'none';
        this.list.style.display = 'none';

        $$('.jodit_dropdown_open, .jodit_popap_open', this.container).forEach((btn) => {
            btn.classList.remove('jodit_dropdown_open', 'jodit_popap_open');
        });

        if (this.__popapOpened && this.parent.selection) {
            this.parent.selection.clear();
        }

        this.__popapOpened = false;
        this.__listOpened = false;
    };

    private static __toggleButton(btn: HTMLElement, enable: boolean) {
        btn.classList.toggle('jodit_disabled', !enable);
        if (enable) {
            if (btn.hasAttribute('disabled')) {
                btn.removeAttribute('disabled');
            }
        } else {
            if (!btn.hasAttribute('disabled')) {
                btn.setAttribute('disabled', 'disabled');
            }
        }
    }

    checkActiveButtons(element: Node|false) {
        const active_class = 'jodit_active';
        this.buttonList.forEach(({control, btn}) => {
            btn.classList.remove(active_class);

            let mode =  (control === undefined || control.mode === undefined) ? consts.MODE_WYSIWYG : control.mode;

            Toolbar.__toggleButton(btn, mode === consts.MODE_SPLIT || mode === this.parent.getRealMode());

            if (!element) {
                return;
            }

            let tags,
                elm,
                css,

                getCSS = (elm: HTMLElement, key: string): string => {
                    return this.parent.win.getComputedStyle(elm).getPropertyValue(key).toString()
                },

                checkActiveStatus = (cssObject, node) => {
                    let matches = 0,
                        total = 0;

                    Object.keys(cssObject).forEach((cssProperty) => {
                        const cssValue = cssObject[cssProperty];
                        if (typeof cssValue === 'function') {
                            if (cssValue({
                                    editor: this.parent,
                                    value: getCSS(node, cssProperty).toLowerCase()
                                })) {
                                matches += 1;
                            }
                        } else {
                            if (cssValue.indexOf(getCSS(node, cssProperty).toLowerCase()) !== -1) {
                                matches += 1;
                            }
                        }
                        total += 1;
                    });

                    if (total === matches) {
                        btn.classList.add(active_class);
                    }
                };

            if (control.tags || (control.options && control.options.tags)) {
                tags = control.tags || (control.options && control.options.tags);

                elm = element;
                Dom.up(elm, (node: Node) => {
                    if (tags.indexOf(node.nodeName.toLowerCase()) !== -1) {
                        btn.classList.add(active_class);
                        return true;
                    }
                }, this.parent.editor);
            }

            //activate by supposed css
            if (control.css || (control.options && control.options.css)) {
                css = control.css || (control.options && control.options.css);


                elm = element;
                Dom.up(elm, (node: HTMLElement) => {
                    if (node && node.nodeType !== Node.TEXT_NODE && !node.classList.contains(active_class)) {
                        checkActiveStatus(css, node);
                    }
                }, this.parent.editor);

            }
        });
    }

    defaultControl:ControlType  = {
        template: (editor: Jodit, key: string, value: string) => (this.parent.i18n(value))
    };

    private buttonList: ButtonType[] = [];
    /**
     *
     */
    addButton(item: string|ControlType, controlOption?: ControlType, content?: string){

        let control: ControlType = extend(true, {}, controlOption, this.defaultControl);

        const btn: HTMLLIElement = <HTMLLIElement>dom('<li>' +
                    '<a href="javascript:void(0)"></a>' +
                    '<div class="jodit_tooltip"></div>' +
                '</li>'),
            name: string = typeof item === 'string' ? item : (item.name || 'empty'),
            a: HTMLAnchorElement = btn.querySelector('a');

        let iconSVG = Toolbar.getIcon(name, false);

        if (iconSVG === false) {
            iconSVG = Toolbar.getIcon(typeof control.name === 'string' ? control.name : 'empty');
        }

        //btn.control =  control;

        const clearName = name.replace(/[^a-zA-Z0-9]/g, '_');

        btn.classList.add('jodit_toolbar_btn'); // fix for ie You can not simply add class and add second parameter
        btn.classList.add('jodit_toolbar_btn-' + clearName);


        this.parent.events.on(camelCase('can-' + clearName), (enable) => {
            Toolbar.__toggleButton(btn, enable);
        });

        let icon =  dom(iconSVG);
        icon.classList.add('jodit_icon', 'jodit_icon_' + clearName);
        a.appendChild(icon);

        if (control === undefined || typeof(control) !== 'object') {
            control = {command: name};
        }

        if (content !== undefined) {
            a.innerHTML = content;
        }

        if (control.list) {
            btn.classList.add('jodit_with_dropdownlist');
            a.appendChild(dom('<span class="jodit_with_dropdownlist-trigger"></span>'))
        }

        if (control.iconURL) {
            a.style.backgroundImage =  'url(' + control.iconURL + ')'
        }

        if (control.tooltip) {
            btn.querySelector('.jodit_tooltip').innerHTML = this.parent.i18n(control.tooltip);
        } else {
            btn.removeChild(btn.querySelector('.jodit_tooltip'));
        }

        btn
            .addEventListener('mousedown',  (originalEvent) => {
                originalEvent.stopImmediatePropagation();
                originalEvent.preventDefault();

                if (btn.classList.contains('jodit_disabled')) {
                    return false;
                }


                if (control.list) {
                    this.openList(btn);
                    each(control.list, (key: string, value: string) => {
                        let elm;
                        if (this.parent.options.controls[value] !== undefined) {
                            elm = this.addButton(value, this.parent.options.controls[value]); // list like array {"align": {list: ["left", "right"]}}
                        } else if (this.parent.options.controls[key] !== undefined) {
                            elm = this.addButton(key, extend({}, this.parent.options.controls[key], value)); // list like object {"align": {list: {"left": {exec: alert}, "right": {}}}}
                        } else {
                            elm = this.addButton(key, {
                                    exec: control.exec,
                                    command: control.command,
                                    args: [
                                        (control.args && control.args[0]) || key,
                                        (control.args && control.args[1]) || value
                                    ]
                                },
                                control.template && control.template(
                                    this.parent,
                                    key,
                                    value
                                )
                            );
                        }

                        this.list.appendChild(elm);
                    });
                    btn.appendChild(this.list);
                } else if (control.exec !== undefined && typeof control.exec === 'function') {
                    control.exec(
                        this.parent,
                        this.parent.selection.current(),
                        control,
                        originalEvent,
                        btn
                    );
                    this.closeAll();
                } else if (control.popup !== undefined && typeof control.popup === 'function') {
                    this.openPopup(btn, control.popup(
                        this.parent,
                        this.parent.selection.current(),
                        control,
                        this.closeAll
                    ));
                } else {
                    if (control.command || name) {
                        this.parent.execCommand(control.command || name, (control.args && control.args[0]) || false, (control.args && control.args[1]) || null);
                        this.closeAll();
                    }
                }
            });

        this.buttonList.push({
            control,
            btn,
            name,
        });

        return btn;
    }

    /**
     *
     * @param {Array|Object} buttons
     * @param {HTMLDivElement} container
     */
    build(buttons: ControlType[]|string[], container: HTMLElement) {
        let lastBtnSeparator: boolean = false;

        this.container.innerHTML = '';

        (<ControlType[]>buttons).forEach((button: ControlType|string) => {
            const name: string = typeof button === 'string' ? <string>button : button.name;

            if (this.parent.options.removeButtons.indexOf(name) !== -1) {
                return;
            }

            if (name !== '|') {
                let control: string|ControlType = button;

                lastBtnSeparator = false;

                if (typeof control !== 'object' && this.parent.options.controls[control] !== undefined) {
                    control = this.parent.options.controls[control];
                }

                if (typeof control !== 'object') {
                    throw new Error('Need ControlType ' + control);
                }

                this.container.appendChild(this.addButton(button, <ControlType>control));
            } else {
                if (!lastBtnSeparator) {
                    lastBtnSeparator = true;
                    this.container.appendChild(dom('<li class="jodit_toolbar_btn jodit_toolbar_btn-separator"></li>'));
                }
            }
        });

        container.appendChild(this.container);
    }

    initEvents = () => {
        this.popup.addEventListener('mousedown', (e: MouseEvent) => {e.stopPropagation()});
        this.list.addEventListener('mousedown', (e: MouseEvent) => {e.stopPropagation()});
        this.__on(window, 'mousedown', () => {
            if (this.__popapOpened || this.__listOpened) {
                this.closeAll();
            }
        });

        this.parent.events.on('mousedown keydown change afterSetMode', () => {
            const callback = () => {
                if (this.parent.selection) {
                    this.checkActiveButtons(this.parent.selection.current())
                }
            };
            if (this.parent.options.observer.timeout) {
                setTimeout(callback, this.parent.options.observer.timeout)
            } else {
                callback();
            }
        });
    };
}