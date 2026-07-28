import ProjectDetail from '@/components/ProjectDetail';

export const metadata = {
  title: 'DevDeck — project',
};

export default function ProjectPage({ params }) {
  return <ProjectDetail projectId={params.id} />;
}
