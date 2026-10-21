import ProjectDetail from '@/components/ProjectDetail';

// Rendered through the root layout's "%s — DevDeck" template. The client swaps
// in the real project name once it loads.
export const metadata = {
  title: 'Project',
};

// Next.js 15+ passes params as a Promise; synchronous access was removed in 16.
export default async function ProjectPage({ params }) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
