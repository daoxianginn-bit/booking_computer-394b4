import BookingCalculator from './pages/BookingCalculator';
import { CalendarRange } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen w-full bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-2">
          <CalendarRange className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800">訂房計算機</h1>
        </div>
      </header>
      <main className="p-6">
        <BookingCalculator />
      </main>
    </div>
  );
}

export default App;
