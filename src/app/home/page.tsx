import Chat from "../components/chat/page";
import PDF from "../components/pdf/page";

export default function Home() {
  return (
    <div className="h-screen flex">
      {/* Left Container - 50% */}
      <div className="w-1/2 bg-white border-r border-gray-300">
        <div className="h-full flex items-center justify-center">
          <PDF />
        </div>
      </div>

      {/* Right Container - 50% */}
      <div className="w-1/2 bg-white">
        <div className="h-full flex items-center justify-center">
          <Chat />
        </div>
      </div>
    </div>
  );
}