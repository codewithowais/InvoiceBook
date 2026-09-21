"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabPanel } from "@/components/activity/tabs";
import { ActivityFeedTab } from "@/components/activity/activity-feed";
import { TrashTab } from "@/components/activity/trash-panel";

const TABS = [
  { value: "activity", label: "Activity log" },
  { value: "trash", label: "Trash" },
];

const ID_BASE = "activity";

export function ActivityClient() {
  const [tab, setTab] = useState("activity");

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Activity"
        description="An audit trail of everything your team does, plus a recoverable trash for deleted records."
      />

      <div className="mb-5">
        <Tabs
          tabs={TABS}
          value={tab}
          onChange={setTab}
          idBase={ID_BASE}
          aria-label="Activity views"
        />
      </div>

      <TabPanel idBase={ID_BASE} value="activity" active={tab === "activity"}>
        <Card className="p-5">
          <ActivityFeedTab />
        </Card>
      </TabPanel>

      <TabPanel idBase={ID_BASE} value="trash" active={tab === "trash"}>
        <TrashTab />
      </TabPanel>
    </div>
  );
}
