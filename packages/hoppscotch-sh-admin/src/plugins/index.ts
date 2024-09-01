import { Component } from 'vue';

export type PluginsDef = {
  ui: {
    additionalConfigurationsItems: Component[];
    additionalMetricItems: Component[];
  };
};

export let plugins: PluginsDef;

export function setPluginsDef(def: PluginsDef) {
  plugins = def;
}
