import { NotificationType } from '@prisma/client';
import { getPreferences } from '@/lib/actions/notificationPreferences';
import { NotificationPreferencesForm } from '@/components/NotificationPreferencesForm';

export default async function SettingsNotificationsPage() {
  const { emailByType, digestFrequency, preferredDigestHour } = await getPreferences();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Notifications</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Control which activity emails you and how often you get a summary.
      </p>

      <div className="mt-6 max-w-xl">
        <NotificationPreferencesForm
          types={Object.values(NotificationType)}
          initialEmailByType={emailByType}
          initialDigestFrequency={digestFrequency}
          initialPreferredDigestHour={preferredDigestHour}
        />
      </div>
    </div>
  );
}
