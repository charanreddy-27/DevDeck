import ProjectDetail from '@/components/ProjectDetail';

// Rendered through the root layout's "%s — DevDeck" template. The client swaps
// in the real project name once it loads.
export const metadata = {
  title: 'Project',
};

export default function ProjectPage({ params }) {
  return <ProjectDetail projectId={params.id} />;
}
