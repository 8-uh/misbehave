"use strict"

import Combokeys from 'combokeys'
import UndoManager from 'undo-manager'
import StrUtil from './utils/string'
import { getSections, setSelection } from './utils/selection'
import { defineNewLine } from './utils/utils'
import store from './utils/store'


export default class Misbehave {
  constructor(elem, { autoIndent = true,
                      autoOpen = true,
                      autoStrip = true,
                      overwrite = true,
                      softTabs = 2,
                      replaceTab = true,
                      pairs = [['(', ')'], ['[', ']'], ['{', '}'], ['"'], ["'"]],
                      oninput = () => {}
                    } = {}) {

    let misbehave = this
    let strUtil = new StrUtil(defineNewLine(), softTabs ? ' '.repeat(softTabs) : '\t')

    let undoMgr = new UndoManager()
    let current = store({ prefix: '', selected: '', suffix: '' })

    let setDom = (value) => {
      var content = value.prefix + value.selected + value.suffix
      elem.textContent = content
      oninput(content, value)
      setSelection(elem, value.prefix.length, value.prefix.length + value.selected.length)
    }

    let update = (update) => {
      let previous = current()
      undoMgr.add({
        undo : () => { setDom(previous) },
        redo : () => { setDom(update) }
      })
      current(update)
      setDom(update)
    }

    let keys = new Combokeys(elem)
    keys.stopCallback = () => false // work without needing to set combokeys class on elements

    keys.bind('mod+z', () => { undoMgr.undo(); return false })
    keys.bind('shift+mod+z', () => { undoMgr.redo(); return false })

    if (autoIndent) {
      keys.bind('enter', () => getSections(elem, ({ prefix, selected, suffix}) => {
        update(strUtil.autoIndent(prefix, selected, suffix))
        return false
      }))
    }

    if (autoStrip) {
      keys.bind('backspace', () => getSections(elem, ({ prefix, selected, suffix }, selection) => {
        if (selection.isCollapsed && strUtil.testAutoStrip(pairs, prefix, selected, suffix)) {
          update(strUtil.autoStrip(prefix, selected, suffix))
          return false
        }
      }))
    }

    const fnAutoOpen = (opening, closing) => () => getSections(elem, ({ prefix, selected, suffix }) => {
      update(strUtil.autoOpen(opening, closing, prefix, selected, suffix))
      return false
    })

    const fnOverwrite = (closing) => () => getSections(elem, ({ prefix, selected, suffix }, selection) => {
      if (selection.isCollapsed && strUtil.testOverwrite(closing, prefix, selected, suffix)) {
        update(strUtil.overwrite(closing, prefix, selected, suffix))
        return false
      }
    })

    pairs.forEach(([opening, closing]) => {
      if (closing) {
        if (autoOpen)  keys.bind(opening, fnAutoOpen(opening, closing))
        if (overwrite) keys.bind(closing, fnOverwrite(closing))
      } else {
        if (autoOpen && overwrite) {
          keys.bind(opening, () => getSections(elem, ({ prefix, selected, suffix }, selection) => {
            if (selection.isCollapsed && strUtil.testOverwrite(opening, prefix, selected, suffix))
              update(strUtil.overwrite(opening, prefix, selected, suffix))
            else
              update(strUtil.autoOpen(opening, opening, prefix, selected, suffix))
            return false
          }))
        } else {
          if (autoOpen)  keys.bind(opening, fnAutoOpen(opening, opening))
          if (overwrite) keys.bind(opening, fnOverwrite(opening))
        }
      }
    })

    if (replaceTab) {
      keys.bind('tab', () => getSections(elem, ({ prefix, selected, suffix }) => {
        update(strUtil.tabIndent(prefix, selected, suffix))
        return false
      }))

      keys.bind('shift+tab', () => getSections(elem, ({ prefix, selected, suffix }) => {
        update(strUtil.tabUnindent(prefix, selected, suffix))
        return false
      }))
    }

    misbehave.__inputListener = elem.addEventListener('input', () => getSections(elem, update))

    oninput(elem.textContent)

    // expose for haxxoers
    misbehave.__elem = elem
    misbehave.__strUtil = strUtil
    misbehave.__undoMgr = undoMgr
    misbehave.__current = current
    misbehave.__setDom = setDom
    misbehave.__update = update
    misbehave.__keys = keys
  }

  destroy () {
    this.__elem.removeEventListener('input', this.__inputListener)
    this.__keys.detach()
    this.__undoMgr.clear()
  }
}
