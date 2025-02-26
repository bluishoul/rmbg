interface Props {
  image: string;
  mattingImage: string | null;
  status: "queued" | "processing" | "completed" | "error";
  onOpen: () => void;
  onRetry: () => void;
}

export default function ImageMatting({
  image,
  mattingImage,
  status,
  onOpen,
  onRetry,
}: Props) {
  const getStatusDisplay = () => {
    switch (status) {
      case "queued":
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <span className="text-white text-sm">排队中...</span>
          </div>
        );
      case "processing":
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <svg
              className="w-8 h-8 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        );
      case "error":
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50">
            <span className="text-red-500 text-sm mb-2 px-3 py-1 bg-black/70 rounded">
              处理失败
            </span>
            <button
              onClick={onRetry}
              className="px-2 py-1 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
            >
              重试
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden">
      <img
        src={mattingImage || image}
        alt="图片"
        className="w-full h-full object-cover cursor-pointer"
        onClick={onOpen}
      />
      {getStatusDisplay()}
    </div>
  );
}
