import { Component } from 'vue';

export enum REGISTERED_COMPONENTS {
  Configurations,
  HoppButton,
}

export type ComponentsDef = {
  name: REGISTERED_COMPONENTS;
  components: Component[];
};

export type RegisteredComponentsDef = ComponentsDef[];
