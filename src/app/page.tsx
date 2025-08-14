export default function HomePage() {
  return (
    <div className="h-dvh bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center overflow-hidden">
      <div className="text-center space-y-6 px-6 max-w-2xl">
        {/* Logo/Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-purple-400 rounded-full flex items-center justify-center text-white text-3xl font-bold">
            SF
          </div>
        </div>

        {/* Main Title */}
        <div className="space-y-3">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-800">
            Study<span className="text-purple-500">Fetch</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 leading-relaxed">
            Your AI-powered tutor that brings PDFs to life
          </p>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <p className="text-lg text-gray-700 leading-relaxed">
            Upload any PDF document and chat with our intelligent AI tutor. 
            Get instant explanations, visual highlights, and interactive learning 
            that adapts to your pace.
          </p>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="space-y-1">
              <div className="text-3xl">📄</div>
              <h3 className="font-semibold text-gray-800">Smart PDF Reading</h3>
              <p className="text-sm text-gray-600">AI understands your documents</p>
            </div>
            <div className="space-y-1">
              <div className="text-3xl">💬</div>
              <h3 className="font-semibold text-gray-800">Interactive Chat</h3>
              <p className="text-sm text-gray-600">Ask questions, get instant answers</p>
            </div>
            <div className="space-y-1">
              <div className="text-3xl">✨</div>
              <h3 className="font-semibold text-gray-800">Visual Highlights</h3>
              <p className="text-sm text-gray-600">See exactly what you need to know</p>
            </div>
          </div>
        </div>

        {/* Sign Up */}
        <div className="space-y-4 pt-4">
          <p className="text-lg text-gray-700 font-medium">
            Ready to transform your learning experience?
          </p>
          <div className="space-y-2">
            <button className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg text-lg transition-colors duration-200 shadow-lg hover:shadow-xl">
              Sign Up for Free
            </button>
            <p className="text-sm text-gray-500">
              Already have an account?
              <a href="/login" className="text-purple-500 hover:text-purple-600 font-medium ml-1">
                Sign in here
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
