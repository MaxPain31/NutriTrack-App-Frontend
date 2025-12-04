import { Stack } from 'expo-router';

export default function ChildrenLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="child-list" />
      <Stack.Screen name="add-child" />
      <Stack.Screen name="child-details" />
      <Stack.Screen name="update-child" />
      <Stack.Screen name="edit-child" />
      <Stack.Screen name="profile-setting" />
    </Stack>
  );
}

