import { useEffect, useState } from "react";
import { getAppVersion } from "../../usecases/app";

export function AppVersion() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  if (!version) return null;

  return (
    <p className="text-[10px] text-text-muted text-center py-1 select-none">
      v{version}
    </p>
  );
}
