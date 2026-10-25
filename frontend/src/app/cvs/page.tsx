import { AppShell } from "@/components/app-shell";
import { CvUpload } from "@/components/cv-upload";

export default function CvsPage() {
  return (
    <AppShell activePath="/cvs">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CANDIDATE PIPELINE</p>
          <h1>CV library</h1>
          <p className="page-subtitle">
            Prepare resume uploads and review processing status when Person
            B&apos;s API is connected.
          </p>
        </div>
      </div>
      <CvUpload />
    </AppShell>
  );
}
