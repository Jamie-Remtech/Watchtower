import { DeviceManager } from '../components/DeviceManager';
import { OrgSettings } from '../components/OrgSettings';
import { NotificationSettings } from '../components/NotificationSettings';
import { useDevices } from '../hooks/useDevices';
import { AirLinks } from '../components/AirLinks';

// Settings = my notifications + organization identity + real device &
// channel management.
export const SettingsTab = () => {
  const { devices, createDevice, updateDevice, removeDevice } = useDevices();

  return (
    <div className="space-y-4">
      <NotificationSettings />
      <OrgSettings />
      <DeviceManager
        devices={devices}
        createDevice={createDevice}
        updateDevice={updateDevice}
        removeDevice={removeDevice}
      />
      <AirLinks />
    </div>
  );
};
