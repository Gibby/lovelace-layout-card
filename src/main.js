import { LitElement, html, css } from "card-tools/src/lit-element";
import { createCard } from "card-tools/src/lovelace-element";
import { hass } from "card-tools/src/hass";

import {buildLayout} from "./layout";

class LayoutCard extends LitElement {

  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  async setConfig(config) {
    this._config = {
      min_height: 5,

      column_width: 300,
      max_width: config.column_width || "500px",

      min_columns: config.column_num || 1,
      max_columns: 100,

      ...config,
    }

    this.cards = [];
    this.columns = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this.place_cards(this.clientWidth);
  }
  async firstUpdated() {
    window.addEventListener('resize', () => this.place_cards());
    window.addEventListener('hass-open-menu', () => setTimeout(() => this.place_cards(), 100));
    window.addEventListener('hass-close-menu', () => setTimeout(() => this.place_cards(), 100));
    window.addEventListener('location-changed', () => {
      if(location.hash === "")
        setTimeout(() => this.place_cards(), 100)
    });
  }

  async updated(changedproperties) {
    if(!this.cards.length
      && ((this._config.entities && this._config.entities.length)
        || (this._config.cards && this._config.cards.length))
      ) {
      // Build cards and layout
      const width = this.clientWidth;
      this.cards = await this.build_cards();
      this.place_cards(width);
    }

    if(changedproperties.has("hass") && this.hass && this.cards) {
      // Update the hass object of every card
      this.cards.forEach((c) => {
        if(!c) return;
        c.hass = this.hass;
      });
    }
  }

  async build_card(c) {
      if(c === "break")
        return null;
      const config = {...c, ...this._config.card_options};
      const el = createCard(config);
      el.hass = hass();

      el.style.gridColumn = config.gridcol;
      el.style.gridRow = config.gridrow;
      // Cards are initially placed in the staging area
      // That places them in the DOM and lets us read their getCardSize() function
      this.shadowRoot.querySelector("#staging").appendChild(el);
      return new Promise((resolve, reject) =>
        el.updateComplete
          ? el.updateComplete.then(() => resolve(el))
          : resolve(el)
        );
  }

  async build_cards() {
    // Clear out any cards in the staging area which might have been built but not placed
    const staging = this.shadowRoot.querySelector("#staging");
    while(staging.lastChild)
      staging.removeChild(staging.lastChild);
    return Promise.all(
      (this._config.entities || this._config.cards)
        .map((c) => this.build_card(c))
    );
  }

  place_cards(width) {
    if(this._config.layout === "grid")
      return;
    if(width !== undefined)
      this.lastWidth = width;
    this.lastWidth = this.clientWidth || this.lastWidth;
    width = this.lastWidth;
    this.columns = buildLayout(
      this.cards,
      width || 1,
      this._config
    );

    if(this._config.rtl)
      this.columns.reverse();

    this.format_columns();

    this.requestUpdate();
  }

  format_columns() {
    const renderProp = (name, property, index, unit="px") => {
      // Check if the config option is specified
      if (this._config[property] === undefined) return "";

      let retval =  `${name}: `;
      const prop = this._config[property];
      if (typeof(prop) === "object")
        // Get the last value if there are not enough
        if(prop.length > index)
          retval += `${prop[index]}`;
        else
          retval += `${prop.slice(-1)}`;
      else
        retval += `${prop}`;

      // Add unit (px) if necessary
      if(!retval.endsWith("px") && !retval.endsWith("%")) retval += unit;
      return retval + ";"
    }

    // Set element style for each column
    for(const [i, c] of this.columns.entries()) {
      const styles = [
        renderProp("max-width", "max_width", i),
        renderProp("min-width", "min_width", i),
        renderProp("width", "column_width", i),
        renderProp("flex-grow", "flex_grow", i, ""),
      ]
      c.style.cssText = ''.concat(...styles);
    }
  }

  getCardSize() {
    if(this.columns)
      return Math.max.apply(Math, this.columns.map((c) => c.length));
  }

  _isPanel() {
    if(this.isPanel) return true;
    let el = this.parentElement;
    let steps = 10;
    while(steps-- && el) {
      if(el.localName === "hui-panel-view") return true;
      if(el.localName === "div") return false;
      el = el.parentElement;
    }
    return false;
  }

  render() {
    if(this._config.layout === "grid")
      return html`
        <div id="staging" class="grid cards"
        style="
        display: grid;
        grid-template-rows: ${this._config.gridrows};
        grid-template-columns: ${this._config.gridcols};
        "></div>
      `;
    return html`
      <div id="columns"
      class="
      ${this._isPanel() ? "panel": " "}
      "
      style="
      ${this._config.justify_content ? `justify-content: ${this._config.justify_content};` : ''}
      ">
        ${this.columns.map((col) => html`
          ${col}
        `)}
      </div>
      <div id="staging"></div>
    `;
  }

  static get styles() {
    return css`
      :host {
        padding: 0 4px;
        display: block;
        margin-bottom: 0!important;
      }

      #columns {
        display: flex;
        flex-direction: row;
        justify-content: center;
        margin-top: -8px;
      }
      #columns.panel {
        margin-top: 0;
      }

      .column {
        flex-basis: 0;
        flex-grow: 1;
        overflow-x: hidden;
      }


      .cards>* {
        display: block;
        margin: 4px 4px 8px;
      }
      .cards>*:first-child {
        margin-top: 8px;
      }
      .cards>*:last-child {
        margin-bottom: 4px;
      }

      #staging:not(.grid) {
        visibility: hidden;
        height: 0;
      }
    `;
  }

  // Compatibility with legacy card-modder
  get _cardModder() {
    return {target: this};
  }

}

if(!customElements.get("layout-card")) {
  customElements.define("layout-card", LayoutCard);
  const pjson = require('../package.json');
  console.info(`%cLAYOUT-CARD ${pjson.version} IS INSTALLED`,
  "color: green; font-weight: bold",
  "");
}
