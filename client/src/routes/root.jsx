const App = () => {
  return (
    <>
      <div className="bg-gray-500 text-white text-4xl">
        <div className="h-screen flex items-center justify-center">
          <div className="border border-white rounded-lg p-8 m-2 flex items-center">
            <a href={`/audio-editor`}>Phase I</a>
          </div>
          <div className="border border-white rounded-lg p-8 m-2 flex items-center">
            <a href={`/voice-chat`}>Phase II</a>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
