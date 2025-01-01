export default function ImageMatting({
  image,
  loading,
  mattingImage,
  onOpen,
}: {
  image: string;
  loading: boolean;
  mattingImage: string | null;
  onOpen: () => void;
}) {
  return (
    <div className="relative aspect-square shadow-lg hover:shadow-xl rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
      <div className="cursor-zoom-in" onClick={() => onOpen()}>
        <img
          src={image}
          alt="original"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: mattingImage ? 0 : 1 }}
        />

        {mattingImage && (
          <img
            src={mattingImage}
            alt="matting"
            className="absolute inset-0 w-full h-full object-cover animate-fade-in bg-gray-800"
            style={{ opacity: 1 }}
          />
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-100">处理中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
