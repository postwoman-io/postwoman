<template>
  <div class="flex flex-col">
    <h1 class="text-lg font-bold text-secondaryDark">{{ t('teams.teams') }}</h1>

    <div class="flex flex-col">
      <div class="flex py-10">
        <HoppButtonPrimary
          :icon="IconAddUsers"
          :label="t('teams.create_team')"
          @click="showCreateTeamModal = true"
        />
      </div>

      <div class="overflow-x-auto">
        <div v-if="fetching" class="flex justify-center">
          <HoppSmartSpinner />
        </div>

        <div v-else-if="error">{{ t('teams.load_list_error') }}</div>

        <HoppSmartTable
          v-else-if="teamsList.length"
          :headings="headings"
          :list="teamsList"
          @onRowClicked="goToTeamDetails"
        >
          <template #head>
            <th class="px-6 py-2">{{ t('teams.id') }}</th>
            <th class="px-6 py-2">{{ t('teams.name') }}</th>
            <th class="px-6 py-2">{{ t('teams.members') }}</th>
            <!-- Empty Heading for the Action Button -->
            <th class="px-6 py-2"></th>
          </template>
          <template #body="{ row: team }">
            <td class="flex py-4 px-7 max-w-[16rem]">
              <span class="truncate">
                {{ team.id }}
              </span>
            </td>

            <td class="py-4 px-7 min-w-[20rem]">
              <span
                class="flex items-center truncate"
                :class="{ truncate: team.name }"
              >
                {{ team.name ?? t('teams.unnamed') }}
              </span>
            </td>

            <td class="py-4 px-8">
              {{ team.members?.length }}
            </td>

            <td @click.stop class="flex justify-end mr-10">
              <div class="relative">
                <tippy interactive trigger="click" theme="popover">
                  <HoppButtonSecondary
                    v-tippy="{ theme: 'tooltip' }"
                    :icon="IconMoreHorizontal"
                  />
                  <template #content="{ hide }">
                    <div
                      ref="tippyActions"
                      class="flex flex-col focus:outline-none"
                      tabindex="0"
                      @keyup.escape="hide()"
                    >
                      <HoppSmartItem
                        :icon="IconTrash"
                        :label="t('teams.delete_team')"
                        class="!hover:bg-red-600 w-full"
                        @click="
                          () => {
                            deleteTeam(team.id);
                            hide();
                          }
                        "
                      />
                    </div>
                  </template>
                </tippy>
              </div>
            </td>
          </template>
        </HoppSmartTable>

        <div v-else class="px-2">
          {{ t('teams.no_teams') }}
        </div>

        <div
          v-if="hasNextPage && teamsList.length >= teamsPerPage"
          class="flex items-center w-28 px-3 py-2 mt-5 mx-auto font-semibold text-secondaryDark bg-divider hover:bg-dividerDark rounded-3xl cursor-pointer"
          @click="fetchNextTeams"
        >
          <span>{{ t('teams.show_more') }}</span>
          <icon-lucide-chevron-down class="ml-2" />
        </div>
      </div>
    </div>
  </div>

  <TeamsAdd
    :show="showCreateTeamModal"
    :allUsersEmail="allUsersEmail"
    :loading-state="createTeamLoading"
    @hide-modal="showCreateTeamModal = false"
    @create-team="createTeam"
  />
  <HoppSmartConfirmModal
    :show="confirmDeletion"
    :title="t('teams.confirm_team_deletion')"
    @hide-modal="confirmDeletion = false"
    @resolve="deleteTeamMutation(deleteTeamID)"
  />
</template>

<script setup lang="ts">
import { useMutation, useQuery } from '@urql/vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import { usePagedQuery } from '~/composables/usePagedQuery';
import IconMoreHorizontal from '~icons/lucide/more-horizontal';
import IconAddUsers from '~icons/lucide/plus';
import IconTrash from '~icons/lucide/trash';
import {
  CreateTeamDocument,
  MetricsDocument,
  RemoveTeamDocument,
  TeamInfoQuery,
  TeamListDocument,
  UsersListDocument,
} from '../../helpers/backend/graphql';

const t = useI18n();
const toast = useToast();

// Get Users List
const { data } = useQuery({ query: MetricsDocument, variables: {} });
const usersPerPage = computed(() => data.value?.infra.usersCount || 10000);

const { list: usersList } = usePagedQuery(
  UsersListDocument,
  (x) => x.infra.allUsers,
  usersPerPage.value,
  { cursor: undefined, take: usersPerPage.value },
  (x) => x.uid
);

const allUsersEmail = computed(() => usersList.value.map((user) => user.email));

// Get Paginated Results of all the teams in the infra
const teamsPerPage = 20;
const {
  fetching,
  error,
  goToNextPage: fetchNextTeams,
  refetch,
  list: teamsList,
  hasNextPage,
} = usePagedQuery(
  TeamListDocument,
  (x) => x.infra.allTeams,
  teamsPerPage,
  { cursor: undefined, take: teamsPerPage },
  (x) => x.id
);

// Table Headings
const headings = [
  { key: 'id', label: t('teams.id') },
  { key: 'name', label: t('teams.name') },
  { key: 'members', label: t('teams.members') },
  { key: 'actions', label: '' },
];

// Create Team
const showCreateTeamModal = ref(false);
const createTeamLoading = ref(false);
const createTeamMutation = useMutation(CreateTeamDocument);

const createTeam = async (newTeamName: string, ownerEmail: string) => {
  if (newTeamName.length < 6) {
    toast.error(t('state.team_name_too_short'));
    return;
  }
  if (ownerEmail.length === 0) {
    toast.error(t('state.enter_team_email'));
    return;
  }

  createTeamLoading.value = true;
  const userUid =
    usersList.value.find((user) => user.email === ownerEmail)?.uid || '';

  const variables = { name: newTeamName.trim(), userUid: userUid };

  const result = await createTeamMutation.executeMutation(variables);
  if (result.error) {
    if (result.error.toString() == '[GraphQL] user/not_found') {
      toast.error(t('state.user_not_found'));
    } else {
      toast.error(t('state.create_team_failure'));
    }
    createTeamLoading.value = false;
  } else {
    toast.success(t('state.create_team_success'));
    showCreateTeamModal.value = false;
    createTeamLoading.value = false;
    refetch();
  }
};

// Go To Individual Team Details Page
const router = useRouter();
const goToTeamDetails = (team: TeamInfoQuery['infra']['teamInfo']) =>
  router.push('/teams/' + team.id);

// Team Deletion
const confirmDeletion = ref(false);
const deleteTeamID = ref<string | null>(null);
const teamDeletion = useMutation(RemoveTeamDocument);

const deleteTeam = (id: string) => {
  confirmDeletion.value = true;
  deleteTeamID.value = id;
};

const deleteTeamMutation = async (id: string | null) => {
  if (!id) {
    confirmDeletion.value = false;
    toast.error(t('state.delete_team_failure'));
    return;
  }
  const variables = { uid: id };
  const result = await teamDeletion.executeMutation(variables);
  if (result.error) {
    toast.error(t('state.delete_team_failure'));
  } else {
    teamsList.value = teamsList.value.filter((team) => team.id !== id);
    toast.success(t('state.delete_team_success'));
  }

  confirmDeletion.value = false;
  deleteTeamID.value = null;
};
</script>
