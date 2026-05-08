import React from 'react';

const Dashboard = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, Sidharth! 👋</h1>
        <p className="text-muted-foreground">Here's what's happening with your productivity today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {['Tasks Due', 'Completed', 'Upcoming Events', 'Notes'].map((title, i) => (
          <div key={i} className="p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group">
            <p className="text-sm text-muted-foreground mb-2">{title}</p>
            <p className="text-3xl font-bold group-hover:text-primary transition-colors">0</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-secondary border border-border h-96 flex items-center justify-center text-muted-foreground">
          Agenda Preview (Coming Soon)
        </div>
        <div className="p-6 rounded-2xl bg-secondary border border-border h-96 flex items-center justify-center text-muted-foreground">
          Quick Actions (Coming Soon)
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
