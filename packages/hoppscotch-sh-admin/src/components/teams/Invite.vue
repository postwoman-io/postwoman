<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('teams.add_member')"
    @close="hideModal"
  >
    <template #body>
      <div v-if="addingUserToTeam" class="flex items-center justify-center p-4">
        <HoppSmartSpinner />
      </div>
      <div v-else class="flex flex-col">
        <div class="flex items-center justify-between flex-1 pt-4">
          <label for="memberList" class="p-4">
            {{ t('teams.add_members') }}
          </label>
          <div class="flex">
            <HoppButtonSecondary
              :icon="IconPlus"
              :label="t('teams.add_new')"
              filled
              @click="addNewMember"
            />
          </div>
        </div>
        <div class="border rounded divide-y divide-dividerLight border-divider">
          <div
            v-for="(member, index) in newMembersList"
            :key="`new-member-${index}`"
            class="flex divide-x divide-dividerLight"
          >
            <HoppSmartAutoComplete
              :value="member.key"
              :placeholder="t('state.email')"
              :source="allUsersEmail"
              :name="'member' + index"
              :spellcheck="true"
              styles="
                w-full pl-3 bg-neutral-900 border-gray-600
              "
              class="flex-1 !flex"
              @input="(email: string) => member.key = email"
            />
            <span>
              <tippy
                interactive
                trigger="click"
                theme="popover"
                :on-shown="() => tippyActions![index].focus()"
              >
                <HoppSmartSelectWrapper>
                  <input
                    class="flex flex-1 px-4 py-2 bg-transparent cursor-pointer"
                    :placeholder="t('teams.permissions')"
                    :name="'value' + index"
                    :value="member.value"
                    readonly
                  />
                </HoppSmartSelectWrapper>
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
                        member.value === 'OWNER' ? IconCircleDot : IconCircle
                      "
                      :active="member.value === 'OWNER'"
                      @click="
                        () => {
                          updateNewMemberRole(index, TeamMemberRole.Owner);
                          hide();
                        }
                      "
                    />
                    <HoppSmartItem
                      :label="t('teams.editor')"
                      :icon="
                        member.value === 'EDITOR' ? IconCircleDot : IconCircle
                      "
                      :active="member.value === 'EDITOR'"
                      @click="
                        () => {
                          updateNewMemberRole(index, TeamMemberRole.Editor);
                          hide();
                        }
                      "
                    />
                    <HoppSmartItem
                      :label="t('teams.viewer')"
                      :icon="
                        member.value === 'VIEWER' ? IconCircleDot : IconCircle
                      "
                      :active="member.value === 'VIEWER'"
                      @click="
                        () => {
                          updateNewMemberRole(index, TeamMemberRole.Viewer);
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
                :icon="IconTrash"
                color="red"
                @click="removeNewMember(index)"
              />
            </div>
          </div>
          <HoppSmartPlaceholder
            v-if="newMembersList.length === 0"
            :src="addGroupImagePath"
            :alt="t('teams.no_members')"
            :text="t('teams.no_members')"
          >
            <template #body>
              <HoppButtonSecondary
                :label="t('teams.add_new')"
                filled
                @click="addNewMember"
              />
            </template>
          </HoppSmartPlaceholder>
        </div>
        <div
          v-if="newMembersList.length"
          class="flex flex-col items-start px-4 py-4 mt-4 border rounded border-dividerLight"
        >
          <span
            class="flex items-center justify-center px-2 py-1 mb-4 font-semibold border rounded-full bg-primaryDark border-divider"
          >
            <icon-lucide-help-circle
              class="mr-2 text-secondaryLight svg-icons"
            />

            {{ t('teams.roles') }}
          </span>
          <p>
            <span class="text-secondaryLight">
              {{ t('teams.roles_description') }}
            </span>
          </p>
          <ul class="mt-4 space-y-4">
            <li class="flex">
              <span
                class="w-1/4 font-semibold uppercase truncate text-secondaryDark max-w-[4rem]"
              >
                {{ t('teams.owner') }}
              </span>
              <span class="flex flex-1">
                {{ t('teams.owner_description') }}
              </span>
            </li>
            <li class="flex">
              <span
                class="w-1/4 font-semibold uppercase truncate text-secondaryDark max-w-[4rem]"
              >
                {{ t('teams.editor') }}
              </span>
              <span class="flex flex-1">
                {{ t('teams.editor_description') }}
              </span>
            </li>
            <li class="flex">
              <span
                class="w-1/4 font-semibold uppercase truncate text-secondaryDark max-w-[4rem]"
              >
                {{ t('teams.viewer') }}
              </span>
              <span class="flex flex-1">
                {{ t('teams.viewer_description') }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('teams.add_member')"
          outline
          @click="addUserasTeamMember"
        />
        <HoppButtonSecondary
          :label="t('teams.cancel')"
          outline
          filled
          @click="hideModal"
        />
      </span>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from '@urql/vue';
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { computed, ref } from 'vue';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import { usePagedQuery } from '~/composables/usePagedQuery';
import { Email, EmailCodec } from '~/helpers/Email';
import IconCircle from '~icons/lucide/circle';
import IconCircleDot from '~icons/lucide/circle-dot';
import IconPlus from '~icons/lucide/plus';
import IconTrash from '~icons/lucide/trash';
import {
  AddUserToTeamByAdminDocument,
  MetricsDocument,
  TeamMemberRole,
  UsersListDocument,
} from '../../helpers/backend/graphql';

const t = useI18n();
const toast = useToast();
const tippyActions = ref<any | null>(null);

const props = defineProps<{
  show: boolean;
  editingTeamID: string;
}>();

const emit = defineEmits<{
  (e: 'hide-modal'): void;
  (e: 'member'): void;
}>();

const addGroupImagePath = `${
  import.meta.env.VITE_ADMIN_URL
}/images/add_group.svg`;

// Get Users List to extract email ids of all users
const { data } = useQuery({ query: MetricsDocument, variables: {} });
const usersPerPage = computed(() => data.value?.infra.usersCount || 10000);

const { list: usersList } = usePagedQuery(
  UsersListDocument,
  (x) => x.infra.allUsers,
  (x) => x.uid,
  usersPerPage.value,
  { cursor: undefined, take: usersPerPage.value }
);

const allUsersEmail = computed(() => usersList.value.map((user) => user.email));

const newMembersList = ref<Array<{ key: string; value: TeamMemberRole }>>([
  {
    key: '',
    value: TeamMemberRole.Viewer,
  },
]);

const addNewMember = () => {
  newMembersList.value.push({
    key: '',
    value: TeamMemberRole.Viewer,
  });
};

const updateNewMemberRole = (index: number, role: TeamMemberRole) => {
  newMembersList.value[index].value = role;
};

const removeNewMember = (index: number) => {
  newMembersList.value.splice(index, 1);
};

const addingUserToTeam = ref<boolean>(false);

// Checks if the member invites are of valid email format and then adds the users to the team
const addUserasTeamMember = async () => {
  addingUserToTeam.value = true;

  const validationResult = pipe(
    newMembersList.value,
    O.fromPredicate(
      (
        memberInvites
      ): memberInvites is Array<{ key: Email; value: TeamMemberRole }> =>
        pipe(
          memberInvites,
          A.every((member) => EmailCodec.is(member.key))
        )
    ),
    O.map(
      A.map((member) =>
        addUserToTeam(member.key, member.value, props.editingTeamID)
      )
    )
  );

  if (O.isNone(validationResult)) {
    // Error handling for no validation
    toast.error(t('users.invalid_user'));
    addingUserToTeam.value = false;
    return;
  }

  hideModal();
};

const hideModal = () => {
  addingUserToTeam.value = false;
  newMembersList.value = [
    {
      key: '',
      value: TeamMemberRole.Viewer,
    },
  ];
  emit('hide-modal');
};

const addUserToTeamMutation = useMutation(AddUserToTeamByAdminDocument);
const addUserToTeam = async (
  email: string,
  userRole: TeamMemberRole,
  teamID: string
) => {
  const variables = { userEmail: email, role: userRole, teamID: teamID };

  const result = await addUserToTeamMutation.executeMutation(variables);

  if (result.error) {
    if (result.error.toString() == '[GraphQL] user/not_found') {
      toast.error(t('state.user_not_found'));
    } else {
      toast.error(t('state.add_user_failure'));
    }
  } else {
    toast.success(t('state.add_user_success'));
    emit('member');
  }
  return result;
};
</script>
