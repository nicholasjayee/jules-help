
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

const BusinessSettingsCard: React.FC = () => {
  return <Card className="mb-6 border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl text-sales-primary">Setup Your Business Details First</CardTitle>
        <CardDescription>
          Set up your business details to personalize your sales records and receipts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">
          Adding your business name, contact information, and preferred currency will ensure your sales
          records and customer receipts display your correct business information.
        </p>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button asChild variant="secondary" className="gap-2">
          <Link to="/settings">
            <Settings size={16} />
            Configure Settings
          </Link>
        </Button>
      </CardFooter>
    </Card>;
};

export default BusinessSettingsCard;
