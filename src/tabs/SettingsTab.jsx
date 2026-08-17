import { DeviceManager } from '../components/DeviceManager';
import { useDevices } from '../hooks/useDevices';

// Settings = real device & channel management against the devices table.
export const SettingsTab = () => {
  const { devices, createDevice, updateDevice, removeDevice } = useDevices();

  return (
    <DeviceManager
      devices={devices}
      createDevice={createDevice}
      updateDevice={updateDevice}
      removeDevice={removeDevice}
    />
  );
};
