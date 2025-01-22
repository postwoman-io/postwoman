<template>
  <div class="flex flex-col">
    <div class="flex flex-col">
      <div class="flex">
        <HoppButtonPrimary
          :icon="IconUserPlus"
          :label="t('teams.add_members')"
          filled
          @click="showInvite = !showInvite"
        />
      </div>

      <div class="border rounded border-divider my-8">
        <HoppSmartPlaceholder
          v-if="team?.teamMembers?.length === 0"
          :text="t('teams.no_members')"
        >
          <template #body>
            <HoppButtonSecondary
              :icon="IconUserPlus"
              :label="t('teams.add_members')"
              @click="
                () => {
                  showInvite = !showInvite;
                }
              "
            />
          </template>
        </HoppSmartPlaceholder>
        <div v-else class="divide-y divide-dividerLight">
          <div
            v-for="(member, index) in membersList"
            :key="`member-${index}`"
            class="flex divide-x divide-dividerLight"
          >
            <input
              class="flex flex-1 px-4 py-3 bg-transparent"
              :placeholder="t('teams.email_title')"
              :name="'param' + index"
              :value="member.email"
              readonly
            />
            <span>
              <tippy
                interactive
                trigger="click"
                theme="popover"
                :on-shown="() => tippyActions![index].focus()"
              >
                <span class="relative">
                  <input
                    class="flex flex-1 px-4 py-3 bg-transparent cursor-pointer"
                    :placeholder="t('teams.permissions')"
                    :name="'value' + index"
                    :value="member.role"
                    readonly
                  />
                  <span
                    class="absolute right-4 top-1/2 transform !-translate-y-1/2"
                  >
                    <IconChevronDown />
                  </span>
                </span>
                <template #content="{ hide }">
                  <div
                    ref="tippyActions"
                    class="flex flex-col focus:outline-none"
                    tabindex="0"
                    @keyup.escape="hide()"
                  >
                    <HoppSmartItem
                      :label="t('teams.owner')"
                      :icon="
                        member.role === 'OWNER' ? IconCircleDot : IconCircle
                      "
                      :active="member.role === 'OWNER'"
                      @click="
                        () => {
                          updateMemberRole(member.userID, TeamMemberRole.Owner);
                          hide();
                        }
                      "
                    />
                    <HoppSmartItem
                      :label="t('teams.editor')"
                      :icon="
                        member.role === 'EDITOR' ? IconCircleDot : IconCircle
                      "
                      :active="member.role === 'EDITOR'"
                      @click="
                        () => {
                          updateMemberRole(
                            member.userID,
                            TeamMemberRole.Editor
                          );
                          hide();
                        }
                      "
                    />
                    <HoppSmartItem
                      :label="t('teams.viewer')"
                      :icon="
                        member.role === 'VIEWER' ? IconCircleDot : IconCircle
                      "
                      :active="member.role === 'VIEWER'"
                      @click="
                        () => {
                          updateMemberRole(
                            member.userID,
                            TeamMemberRole.Viewer
                          );
                          hide();
                        }
                      "
                    />
                  </div>
                </template>
              </tippy>
            </span>
            <div class="flex">
              <HoppButtonSecondary
                id="member"
                v-tippy="{ theme: 'tooltip' }"
                :title="t('teams.remove')"
                :icon="IconUserMinus"
                color="red"
                :loading="isLoadingIndex === index"
                @click="removeExistingTeamMember(member.userID, index)"
              />
            </div>
          </div>
        </div>
      </div>
      <div v-if="!team" class="flex flex-col items-center">
        <icon-lucide-help-circle class="mb-4 svg-icons" />
        {{ t('teams.error') }}
      </div>
    </div>

    <div class="flex">
      <HoppButtonPrimary
        v-if="areRolesUpdated"
        :label="t('teams.save_changes')"
        outline
        @click="saveUpdatedTeam"
      />
    </div>
    <TeamsInvite
      :show="showInvite"
      :team="team"
      :editingTeamID="route.params.id.toString()"
      @member="updateMembers"
      @hide-modal="
        () => {
          showInvite = false;
        }
      "
    />
  </div>
</template>

<script setup lang="ts">
import { useMutation } from '@urql/vue';
import { useVModel } from '@vueuse/core';
import { cloneDeep, isEqual } from 'lodash-es';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import { useClientHandler } from '~/composables/useClientHandler';
import { getCompiledErrorMessage } from '~/helpers/errors';
import IconChevronDown from '~icons/lucide/chevron-down';
import IconCircle from '~icons/lucide/circle';
import IconCircleDot from '~icons/lucide/circle-dot';
import IconUserMinus from '~icons/lucide/user-minus';
import IconUserPlus from '~icons/lucide/user-plus';
import {
  ChangeUserRoleInTeamByAdminDocument,
  RemoveUserFromTeamByAdminDocument,
  TeamInfoDocument,
  TeamInfoQuery,
  TeamMemberRole,
} from '../../helpers/backend/graphql';

const t = useI18n();
const toast = useToast();
const route = useRoute();

const props = defineProps<{
  team: TeamInfoQuery['infra']['teamInfo'];
}>();

const emit = defineEmits<{
  (event: 'update:team', team: TeamInfoQuery['infra']['teamInfo']): void;
}>();

const teamDetails = useVModel(props, 'team', emit);

// Used to Invoke the Invite Members Modal
const showInvite = ref(false);

const { fetchData: getTeamInfo, data: teamInfo } = useClientHandler(
  TeamInfoDocument,
  {
    teamID: route.params.id.toString(),
  }
);

onMounted(async () => {
  await getTeamInfo();
});

const team = computed(() => teamInfo.value?.infra.teamInfo);

// Update members tab after a change in the members list or member roles
const updateMembers = async () => {
  if (!team.value) return;
  await getTeamInfo();
  teamDetails.value = team.value;
};

// Template refs
const tippyActions = ref<any | null>(null);

// Roles of the members in the team
const currentMemberRoles = ref<
  {
    userID: string;
    role: TeamMemberRole;
  }[]
>([]);

// Roles of the members in the team after the updates but before saving
const updatedMemberRoles = ref<
  {
    userID: string;
    role: TeamMemberRole;
  }[]
>(cloneDeep(currentMemberRoles.value));

// Check if the roles of the members have been updated
const areRolesUpdated = computed(() =>
  currentMemberRoles.value && updatedMemberRoles.value
    ? !isEqual(currentMemberRoles.value, updatedMemberRoles.value)
    : false
);

// Update the role of the member selected in the UI
const updateMemberRole = (userID: string, role: TeamMemberRole) => {
  const updateIndex = updatedMemberRoles.value.findIndex(
    (item) => item.userID === userID
  );
  if (updateIndex !== -1) {
    // Role Update exists
    updatedMemberRoles.value[updateIndex].role = role;
  } else {
    // Role Update does not exist
    updatedMemberRoles.value.push({
      userID,
      role,
    });
  }
};

// Obtain the list of members in the team
const membersList = computed(() => {
  if (!team.value) return [];
  const members = (team.value.teamMembers ?? []).map((member) => {
    const updatedRole = updatedMemberRoles.value.find(
      (update) => update.userID === member.user.uid
    );

    return {
      userID: member.user.uid,
      email: member.user.email!,
      role: updatedRole?.role ?? member.role,
    };
  });

  return members;
});

// Change the role of the selected user in the team
const changeUserRoleInTeamMutation = useMutation(
  ChangeUserRoleInTeamByAdminDocument
);
const changeUserRoleInTeam = (
  userUID: string,
  teamID: string,
  newRole: TeamMemberRole
) => {
  return changeUserRoleInTeamMutation.executeMutation({
    userUID,
    teamID,
    newRole,
  });
};

// Save the updates done to the team
const isLoading = ref(false);

const saveUpdatedTeam = async () => {
  isLoading.value = true;

  const isOwnerPresent = membersList.value.some(
    (member) => member.role === TeamMemberRole.Owner
  );

  if (!isOwnerPresent) {
    toast.error(t('state.owner_not_present'));
    isLoading.value = false;
    return;
  }

  updatedMemberRoles.value.forEach(async (update) => {
    if (!team.value) return;

    const updateMemberRoleResult = await changeUserRoleInTeam(
      update.userID,
      team.value.id,
      update.role
    );
    if (updateMemberRoleResult.error) {
      toast.error(t('state.role_update_failed'));
    } else {
      toast.success(t('state.role_update_success'));
      currentMemberRoles.value = updatedMemberRoles.value;
      updatedMemberRoles.value = cloneDeep(currentMemberRoles.value);
    }
    isLoading.value = false;
  });
};

// Remove user from the team mutation
const removeUserFromTeamMutation = useMutation(
  RemoveUserFromTeamByAdminDocument
);
const removeUserFromTeam = (userUid: string, teamID: string) => {
  return () =>
    removeUserFromTeamMutation.executeMutation({
      userUid,
      teamID,
    });
};

// Remove a team member from the team
const isLoadingIndex = ref<null | number>(null);

const removeExistingTeamMember = async (userID: string, index: number) => {
  if (!team.value) return;
  isLoadingIndex.value = index;
  const removeTeamMemberResult = await removeUserFromTeam(
    userID,
    team.value.id
  )();
  if (removeTeamMemberResult.error) {
    const compiledErrorMessage = getCompiledErrorMessage(
      removeTeamMemberResult.error.message
    );

    compiledErrorMessage
      ? toast.error(t(compiledErrorMessage))
      : toast.error(t('state.remove_member_failure'));
  } else {
    team.value.teamMembers = team.value.teamMembers?.filter(
      (member: any) => member.user.uid !== userID
    );
    teamDetails.value = team.value;
    toast.success(t('state.remove_member_success'));
  }
  isLoadingIndex.value = null;
};
</script>
