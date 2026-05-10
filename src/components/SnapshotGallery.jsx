function getScenes({ scenes = [], components = [] }) {
  if (scenes.length > 0) return scenes
  return components.map((component, index) => ({
    id: component.id || `scene-${String(index + 1).padStart(2, '0')}`,
    title: component.id || `镜头 ${index + 1}`,
  }))
}

export default function SnapshotGallery({ slug, scenes = [], components = [] }) {
  const snapshotScenes = getScenes({ scenes, components })
  if (!slug || snapshotScenes.length === 0) return null

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold text-white">
        Remotion 截图
        <span className="ml-2 text-xs font-normal text-gray-500">{snapshotScenes.length} 张</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {snapshotScenes.map((scene, index) => {
          const src = `/videos/${encodeURIComponent(slug)}/snapshots/scene_${String(index).padStart(2, '0')}.png`
          return (
            <figure key={`${scene.id}-${index}`} className="bg-gray-800/50 rounded-lg overflow-hidden">
              <img
                src={src}
                alt={`${scene.title || scene.id || `镜头 ${index + 1}`} 截图`}
                className="w-full aspect-video object-cover border-b border-gray-700"
                loading="lazy"
              />
              <figcaption className="px-3 py-2 flex items-center gap-2">
                <span className="text-xs font-mono bg-tech-500/20 text-tech-400 px-2 py-0.5 rounded">
                  {scene.id || `scene-${String(index + 1).padStart(2, '0')}`}
                </span>
                <span className="text-sm text-gray-300 truncate">{scene.title || `镜头 ${index + 1}`}</span>
              </figcaption>
            </figure>
          )
        })}
      </div>
    </section>
  )
}
