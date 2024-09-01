<!-- <template>
  <div v-for="(component, index) in pluginComponents.components" :key="index">
    <component :is="component.component" v-bind="component.props" />
  </div>
</template>

<script setup lang="ts">
import { ComponentsDef } from '../../helpers/components';
import { onMounted } from 'vue';

const props = defineProps<{
  pluginComponents: ComponentsDef;
}>();

onMounted(() => {
  console.log(props.pluginComponents);
});
</script> -->
