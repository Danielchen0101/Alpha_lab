import React from 'react';

const TestComponent = () => {
  return (
    <div>
      {true ? (() => {
        return <span>Test</span>;
      })() : null}
    </div>
  );
};

export default TestComponent;
