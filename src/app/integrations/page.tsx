import { IntegrationList } from "./components/integrations-list";
import { OpenEmbeddedUIButton } from "./components/open-embedded-ui-button";

export default function Integrations() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Integrations
          </h1>
          <p className="text-gray-500">
            Import data from various sources and configure specific folders or
            files to track for updates.
          </p>
        </div>
        <OpenEmbeddedUIButton />
      </div>
      <IntegrationList />
    </div>
  );
}
