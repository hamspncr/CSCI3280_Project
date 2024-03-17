const handleRecord = () => {
    console.log("test");
  };

const RecordButton = () => {
  return (
    <button
      onClick={handleRecord}
      className="border border-gray-50 rounded-lg p-2 m-2"
    >
      Record
    </button>
  );
};

export default RecordButton;
