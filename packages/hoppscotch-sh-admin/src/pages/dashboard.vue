<template>
  <div class="flex flex-col">
    <h1 class="text-lg font-bold text-secondaryDark">
      {{ t('metrics.dashboard') }}
    </h1>

    <div v-if="fetching" class="flex justify-center py-6">
      <HoppSmartSpinner />
    </div>

    <div v-else-if="error || !metrics">
      <p class="text-xl">{{ t('metrics.no_metrics') }}</p>
    </div>

    <div v-else>
      <div class="py-10 grid lg:grid-cols-2 gap-6">
        <DashboardMetricsCard
          :count="metrics.usersCount"
          :label="t('metrics.total_users')"
          :icon="UserIcon"
          color="text-green-400"
        />
        <DashboardMetricsCard
          :count="metrics.teamsCount"
          :label="t('metrics.total_teams')"
          :icon="UsersIcon"
          color="text-pink-400"
        />
        <DashboardMetricsCard
          :count="metrics.teamRequestsCount"
          :label="t('metrics.total_requests')"
          :icon="LineChartIcon"
          color="text-cyan-400"
        />
        <DashboardMetricsCard
          :count="metrics.teamCollectionsCount"
          :label="t('metrics.total_collections')"
          :icon="FolderTreeIcon"
          color="text-orange-400"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@urql/vue';
import { MetricsDocument } from '../helpers/backend/graphql';
import UserIcon from '~icons/lucide/user';
import UsersIcon from '~icons/lucide/users';
import LineChartIcon from '~icons/lucide/line-chart';
import FolderTreeIcon from '~icons/lucide/folder-tree';
import { useI18n } from '../composables/i18n';

const t = useI18n();

// Get Metrics Data
const { fetching, error, data } = useQuery({
  query: MetricsDocument,
  variables: {},
});
const metrics = computed(() => data?.value?.infra);
</script>
