import { Brief } from "@/components/Brief";
import { Agenda } from "@/components/Agenda";
import { Tasks } from "@/components/Tasks";
import { Inbox } from "@/components/Inbox";

export function TodayPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-6 pb-20 text-left">
      <Brief />
      <div className="grid items-start gap-[22px] lg:grid-cols-[350px_1fr]">
        <div>
          <Agenda />
          <Tasks />
        </div>
        <div>
          <Inbox />
        </div>
      </div>
    </main>
  );
}
