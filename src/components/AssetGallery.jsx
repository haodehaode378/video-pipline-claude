export default function AssetGallery({ assets = {}, scenes = [] }) {
  if (!assets || Object.keys(assets).length === 0) return null

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">素材资源</h3>
      {scenes.map((scene) => {
        const sceneAssets = assets[scene.id]
        if (!sceneAssets || sceneAssets.length === 0) return null

        return (
          <div key={scene.id} className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-mono bg-tech-500/20 text-tech-400 px-2 py-0.5 rounded">
                {scene.id}
              </span>
              <span className="text-sm text-gray-300">{scene.title}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {sceneAssets.map((asset, i) => (
                <div key={i} className="relative group">
                  <img
                    src={asset.previewUrl}
                    alt={`${scene.title} 素材 ${i + 1}`}
                    className="w-full aspect-video object-cover rounded-lg border border-gray-700"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-gray-300">
                      {asset.source} · {asset.width}x{asset.height}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
