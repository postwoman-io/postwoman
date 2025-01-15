<template>
  <div class="flex flex-col">
    <div class="flex">
      <button class="p-2 rounded-3xl bg-divider" @click="router.push('/users')">
        <icon-lucide-arrow-left class="text-xl" />
      </button>
    </div>

    <div class="flex justify-between items-center py-6">
      <div>
        <h3 class="text-lg font-bold text-accentContrast">
          {{ t('users.pending_invites') }}
        </h3>
        <div class="flex">
          <p class="my-1 text-secondaryLight">
            {{ t('users.pending_invites_description') }}
          </p>
          <HoppSmartAnchor
            blank
            to="https://docs.hoppscotch.io/documentation/self-host/community-edition/admin-dashboard#pending-invites"
            :label="t('support.more_info')"
            class="underline ml-1"
          />
          <icon-lucide-arrow-up-right class="underline w-4 h-4" />
        </div>
      </div>

      <HoppButtonSecondary
        v-if="pendingInvites?.length"
        :label="t('users.copy_invite_link')"
        outline
        filled
        @click="copyInviteLink"
      />
    </div>

    <div class="flex flex-col">
      <div class="relative py-2 overflow-x-auto">
        <div v-if="fetching" class="flex justify-center">
          <HoppSmartSpinner />
        </div>

        <div v-else-if="error">
          {{ t('users.invite_load_list_error') }}
        </div>

        <div v-else-if="pendingInvites?.length === 0">
          {{ t('users.no_invite') }}
        </div>

        <HoppSmartTable
          v-else
          :headings="headings"
          :list="pendingInvites"
          :selected-rows="selectedRows"
        >
          <template #invitedOn="{ item }">
            <div v-if="item" class="pr-2 truncate">
              <span class="truncate">
                {{ getCreatedDate(item.invitedOn) }}
              </span>

              <div class="text-gray-400 text-tiny">
                {{ getCreatedTime(item.invitedOn) }}
              </div>
            </div>
            <span v-else> - </span>
          </template>
          <template #action="{ item }">
            <div v-if="item" class="my-1 mr-2">
              <HoppButtonSecondary
                v-if="lgAndLarger"
                :icon="IconTrash"
                :label="t('users.revoke_invitation')"
                class="text-secondaryDark bg-red-500 hover:bg-red-600"
                @click="confirmInviteDeletion(item.inviteeEmail)"
              />
              <HoppButtonSecondary
                v-else
                v-tippy="{ theme: 'tooltip' }"
                :icon="IconTrash"
                :title="t('users.revoke_invitation')"
                class="ml-2 !text-red-500"
                @click="confirmInviteDeletion(item.inviteeEmail)"
              />
            </div>
          </template>
        </HoppSmartTable>

        <div
          v-if="hasNextPage"
          class="flex items-center w-28 px-3 py-2 mt-5 mx-auto font-semibold text-secondaryDark bg-divider hover:bg-dividerDark rounded-3xl cursor-pointer"
          @click="fetchNextInvites"
        >
          <span>{{ t('users.show_more') }}</span>
          <icon-lucide-chevron-down class="ml-2" />
        </div>

        <div
          v-if="selectedRows.length"
          class="fixed m-2 bottom-0 left-40 right-0 w-min mx-auto shadow-2xl"
        >
          <div
            class="flex justify-center items-end bg-primaryLight border border-divider rounded-md mb-5"
          >
            <HoppButtonSecondary
              :label="t('state.selected', { count: selectedRows.length })"
              class="py-4 border-divider rounded-r-none bg-emerald-800 text-secondaryDark"
            />

            <HoppButtonSecondary
              :icon="IconTrash"
              :label="t('users.revoke_invitation')"
              class="py-4 border-divider rounded-l-none hover:bg-red-500"
              @click="confirmDeletion = true"
            />
          </div>
        </div>
      </div>
    </div>

    <HoppSmartConfirmModal
      :show="confirmDeletion"
      :title="
        selectedRows.length > 0
          ? t('state.confirm_delete_invites')
          : t('state.confirm_delete_invite')
      "
      @hide-modal="confirmDeletion = false"
      @resolve="deleteInvitation(inviteToBeDeleted)"
    />
  </div>
</template>

<script setup lang="ts">
import { useMutation } from '@urql/vue';
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';
import { format } from 'date-fns';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import { usePagedQuery } from '~/composables/usePagedQuery';
import { copyToClipboard } from '~/helpers/utils/clipboard';
import IconTrash from '~icons/lucide/trash';
import {
  InvitedUsersDocument,
  InvitedUsersQuery,
  RevokeUserInvitationsByAdminDocument,
} from '../../helpers/backend/graphql';

const t = useI18n();
const toast = useToast();
const router = useRouter();

const breakpoints = useBreakpoints(breakpointsTailwind);
const lgAndLarger = breakpoints.greater('lg');

const invitesPerPage = 10;
const page = ref(1);

// Get Proper Date Formats
const getCreatedDate = (date: string) => format(new Date(date), 'dd-MMMM-yyyy');
const getCreatedTime = (date: string) => format(new Date(date), 'hh:mm a');

// Table Headings
const headings = [
  { key: 'inviteeEmail', label: t('users.invitee_email') },
  { key: 'adminEmail', label: t('users.invited_by') },
  { key: 'invitedOn', label: t('users.invited_on') },
  { key: 'action', label: 'Action' },
];

// Fetch Invites
const {
  fetching,
  error,
  refetch,
  list: invitesList,
} = usePagedQuery(
  InvitedUsersDocument,
  (x) => x.infra.invitedUsers,
  invitesPerPage,
  { take: invitesPerPage, skip: (page.value - 1) * invitesPerPage }
);

const pendingInvites = ref<InvitedUsersQuery['infra']['invitedUsers']>([]);

// Populate pending invites
watch(
  invitesList,
  (newInvitesList) => {
    if (!newInvitesList) return;

    const newInvites = newInvitesList.filter(
      (newInvite) =>
        !pendingInvites.value.some(
          (existingInvite) =>
            existingInvite.inviteeEmail === newInvite.inviteeEmail
        )
    );
    pendingInvites.value.push(...newInvites);
  },
  { immediate: true, deep: true }
);

// Pagination
const hasNextPage = computed(() => invitesList.value.length === invitesPerPage);

const fetchNextInvites = () => {
  page.value += 1;
  refetch({ take: invitesPerPage, skip: (page.value - 1) * invitesPerPage });
};

// Selected Rows
const selectedRows = ref<InvitedUsersQuery['infra']['invitedUsers']>([]);

// Delete Invite
const confirmDeletion = ref(false);
const inviteToBeDeleted = ref<string | null>(null);
const deleteInvitationMutation = useMutation(
  RevokeUserInvitationsByAdminDocument
);

const confirmInviteDeletion = (inviteeEmail: string | null) => {
  confirmDeletion.value = true;
  inviteToBeDeleted.value = inviteeEmail;
};

const deleteInvitation = async (email: string | null) => {
  const inviteeEmails = email
    ? [email]
    : selectedRows.value.map((row) => row.inviteeEmail);

  const variables = { inviteeEmails };
  const result = await deleteInvitationMutation.executeMutation(variables);

  if (result.error) {
    email
      ? toast.error(t('state.delete_invite_failure'))
      : toast.error(t('state.delete_invites_failure'));
  } else {
    pendingInvites.value = pendingInvites.value?.filter(
      (user) => !inviteeEmails.includes(user.inviteeEmail)
    );
    selectedRows.value.splice(0, selectedRows.value.length);
    email
      ? toast.success(t('state.delete_invite_success'))
      : toast.success(t('state.delete_invites_success'));
  }

  confirmDeletion.value = false;
  inviteToBeDeleted.value = null;
};

const baseURL = import.meta.env.VITE_BASE_URL ?? '';

const copyInviteLink = () => {
  copyToClipboard(baseURL);
  toast.success(t('state.copied_to_clipboard'));
};
</script>
