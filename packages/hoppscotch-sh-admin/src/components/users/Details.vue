<template>
  <div class="rounded-md">
    <div class="grid gap-6">
      <div
        class="relative"
        :class="
          user.photoURL
            ? 'h-20 w-20'
            : 'bg-primaryDark w-16 p-3 rounded-2xl mb-3'
        "
      >
        <img
          v-if="user.photoURL"
          class="object-cover rounded-3xl mb-3"
          :src="user.photoURL"
        />
        <icon-lucide-user v-else class="text-4xl" />
        <span
          v-if="user.isAdmin"
          class="absolute left-16 bottom-0 text-xs font-medium px-3 py-0.5 rounded-full bg-green-900 text-green-300"
        >
          {{ t('users.admin') }}
        </span>
      </div>

      <template v-for="(info, key) in userInfo" :key="key">
        <div v-if="key === 'displayName'" class="flex flex-col space-y-3">
          <label class="text-accentContrast" for="teamname"
            >{{ t('users.name') }}
          </label>
          <div
            class="flex bg-divider rounded-md items-stretch flex-1 border border-divider"
            :class="{
              '!border-accent': isNameBeingEdited,
            }"
          >
            <HoppSmartInput
              v-model="updatedUserName"
              styles="bg-transparent flex-1 rounded-md !rounded-r-none disabled:select-none border-r-0 disabled:cursor-default disabled:opacity-50"
              :placeholder="t('users.name')"
              :disabled="!isNameBeingEdited"
            >
              <template #button>
                <HoppButtonPrimary
                  class="!rounded-l-none"
                  filled
                  :icon="isNameBeingEdited ? IconSave : IconEdit"
                  :label="
                    isNameBeingEdited ? t('users.rename') : t('users.edit')
                  "
                  @click="handleNameEdit"
                />
              </template>
            </HoppSmartInput>
          </div>
        </div>

        <div v-else-if="info.condition">
          <label class="text-secondaryDark" :for="key">{{ info.label }}</label>
          <div class="w-full p-3 mt-2 bg-divider border-gray-600 rounded-md">
            <span>{{ info.value }}</span>
          </div>
        </div>
      </template>
    </div>

    <div class="flex justify-start mt-8">
      <HoppButtonPrimary
        :icon="user.isAdmin ? IconUserMinus : IconUserCheck"
        :label="
          user.isAdmin
            ? t('users.remove_admin_privilege')
            : t('users.make_admin')
        "
        filled
        outline
        class="mr-4"
        @click="
          user.isAdmin
            ? emit('remove-admin', user.uid)
            : emit('make-admin', user.uid)
        "
      />

      <HoppButtonSecondary
        :icon="IconTrash"
        :label="t('users.delete')"
        filled
        outline
        class="mr-4 bg-red-600 text-white hover:text-gray-100"
        @click="
          user.isAdmin
            ? toast.error(t('state.remove_admin_to_delete_user'))
            : emit('delete-user', user.uid)
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMutation } from '@urql/vue';
import { useTimeAgo } from '@vueuse/core';
import { format } from 'date-fns';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import {
  UpdateUserDisplayNameByAdminDocument,
  UserInfoQuery,
} from '~/helpers/backend/graphql';
import IconEdit from '~icons/lucide/edit';
import IconSave from '~icons/lucide/save';
import IconTrash from '~icons/lucide/trash';
import IconUserCheck from '~icons/lucide/user-check';
import IconUserMinus from '~icons/lucide/user-minus';

const t = useI18n();
const toast = useToast();

const props = defineProps<{
  user: UserInfoQuery['infra']['userInfo'];
}>();

const emit = defineEmits<{
  (event: 'delete-user', userID: string): void;
  (event: 'make-admin', userID: string): void;
  (event: 'remove-admin', userID: string): void;
  (event: 'update-user-name', newName: string): void;
}>();

// Get Proper Date Formats
const getCreatedDateAndTime = (date: string) =>
  format(new Date(date), 'd-MMMM-yyyy , hh:mm a');

// User Info
const { uid, displayName, email, createdOn, lastActiveOn } = props.user;

const userInfo = {
  uid: {
    condition: uid,
    label: t('users.uid'),
    value: uid,
  },
  displayName: {
    condition: true,
    label: t('users.name'),
    value: displayName ?? t('users.unnamed'),
  },
  email: {
    condition: email,
    label: t('users.email'),
    value: email,
  },
  createdOn: {
    condition: createdOn,
    label: t('users.created_on'),
    value: getCreatedDateAndTime(createdOn),
  },
  lastActiveOn: {
    condition: lastActiveOn,
    label: t('users.last_active_on'),
    value: lastActiveOn
      ? useTimeAgo(lastActiveOn).value
      : t('users.not_available'),
  },
};

// Contains the actual user name
const userName = computed({
  get: () => props.user.displayName,
  set: (value) => {
    return value;
  },
});

// Contains the stored user name from the actual name before being edited
const currentUserName = ref('');

// Set the current user name to the actual user name
onMounted(() => {
  if (displayName) currentUserName.value = displayName;
});

// Contains the user name that is being edited
const updatedUserName = computed({
  get: () => currentUserName.value,
  set: (value) => {
    currentUserName.value = value;
  },
});

// Rename the user
const isNameBeingEdited = ref(false);
const userRename = useMutation(UpdateUserDisplayNameByAdminDocument);

const handleNameEdit = () => {
  if (isNameBeingEdited.value) {
    // If the name is not changed, then return control
    if (userName.value !== updatedUserName.value) {
      renameUserName();
    } else isNameBeingEdited.value = false;
  } else {
    isNameBeingEdited.value = true;
  }
};

const renameUserName = async () => {
  if (updatedUserName.value?.trim() === '') {
    toast.error(t('users.empty_name'));
    return;
  }

  const variables = { userUID: uid, name: updatedUserName.value as string };
  const result = await userRename.executeMutation(variables);

  if (result.error) {
    toast.error(t('state.rename_user_failure'));
  } else {
    isNameBeingEdited.value = false;
    toast.success(t('state.rename_user_success'));
    emit('update-user-name', updatedUserName.value as string);
    userName.value = updatedUserName.value;
  }
};
</script>
