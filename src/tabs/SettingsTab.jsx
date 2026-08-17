import { DeviceManager } from '../components/DeviceManager';
import { OrgSettings } from '../components/OrgSettings';
import { useDevices } from '../hooks/useDevices';

// Settings = organization identity + real device & channel management.
export const SettingsTab = () => {
  const { devices, createDevice, updateDevice, removeDevice } = useDevices();

  return (
    <div className="space-y-4">
      <OrgSettings />
      <DeviceManager
        devices={devices}
        createDevice={createDevice}
        updateDevice={updateDevice}
        removeDevice={removeDevice}
      />
    </div>
  );
};
